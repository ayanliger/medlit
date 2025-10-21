import {
  buildKeyPointsPrompt,
  buildMethodologyPrompt,
  buildSimplificationPrompt,
  buildStructuredSummaryPrompt,
  buildStudyTypePrompt,
  buildSystematicReviewPrompt,
  buildDiagnosticAccuracyPrompt,
  buildObservationalPrompt,
  buildCaseReportPrompt,
  buildQualitativePrompt,
  buildBasicSciencePrompt
} from "./promptTemplates.js";
import {
  createFallbackSummary,
  createFallbackMethodology,
  createFallbackSimplification,
  createFallbackTranslation,
  createFallbackKeyPoints
} from "./fallbacks.js";
import { MODEL_UNAVAILABLE_MESSAGE } from "../shared/constants.js";

/**
 * Generates a framework-aware structured summary of a medical research paper
 * Steps:
 * 1) Classify study type and framework
 * 2) Use an appropriate prompt template
 * 3) Always include studyType/framework in the output; include frameworkSpecific when applicable
 * @param {Object} documentSnapshot - Document snapshot containing meta and article content
 * @returns {Promise<Object>} Structured summary object
 */
export async function generateStructuredSummary(documentSnapshot) {
  const fallback = createFallbackSummary(documentSnapshot, MODEL_UNAVAILABLE_MESSAGE);

  // 1) Attempt study-type classification first (separate short session)
  const classification = await detectStudyType(documentSnapshot);

  // 2) Create main session for extraction
  const session = await createLanguageModelSession({
    systemPrompt: "You are a medical research analyst. Output strictly valid JSON.",
    temperature: 0.3,
    topK: 10
  }, "en");

  if (!session) {
    // Attach classification (if any) to the fallback output
    if (classification?.data) {
      fallback.data.studyType = classification.data.studyType || fallback.data.studyType;
      fallback.data.framework = classification.data.framework || fallback.data.framework;
    }
    return fallback;
  }

  try {
    // 3) Choose prompt based on classification
    const type = classification?.data?.studyType || "Other";
    const framework = classification?.data?.framework || "None";

    let prompt;
    if (type === "Systematic Review" || type === "Meta-Analysis") {
      prompt = buildSystematicReviewPrompt(documentSnapshot);
    } else if (type === "Diagnostic Accuracy") {
      prompt = buildDiagnosticAccuracyPrompt(documentSnapshot);
    } else if (type === "Cohort" || type === "Case-Control" || type === "Cross-Sectional") {
      prompt = buildObservationalPrompt(documentSnapshot);
    } else if (type === "Case Report" || type === "Case Series") {
      prompt = buildCaseReportPrompt(documentSnapshot);
    } else if (type === "Qualitative") {
      prompt = buildQualitativePrompt(documentSnapshot);
    } else if (type === "Basic Science") {
      prompt = buildBasicSciencePrompt(documentSnapshot);
    } else {
      // Default to PICO-style clinical extraction (RCT, interventional, or unknown)
      prompt = buildStructuredSummaryPrompt(documentSnapshot);
    }

    const response = await session.prompt(prompt);
    const parsed = safeJsonParse(response);

    if (!parsed) {
      throw new Error("Language model returned invalid JSON.");
    }

    // Ensure classification annotations are present
    if (!parsed.studyType && classification?.data?.studyType) {
      parsed.studyType = classification.data.studyType;
    }
    if (!parsed.framework && classification?.data?.framework) {
      parsed.framework = classification.data.framework;
    }

    return {
      source: "chrome-ai-language-model",
      generatedAt: new Date().toISOString(),
      classification,
      data: parsed
    };
  } catch (error) {
    console.warn("MedLit: falling back for structured summary", error);
    const result = {
      ...fallback,
      warning: error.message
    };
    if (classification?.data) {
      result.data.studyType = classification.data.studyType || result.data.studyType;
      result.data.framework = classification.data.framework || result.data.framework;
    }
    return result;
  } finally {
    destroySession(session);
  }
}

/**
 * Evaluates the methodological quality of a research study
 * @param {Object} params - Parameters object
 * @param {string} params.methodsText - The methods section text
 * @param {string} params.fullText - The full paper text for context
 * @returns {Promise<Object>} Methodology assessment with quality scores
 */
export async function evaluateMethodology({ methodsText, fullText }) {
  const fallback = createFallbackMethodology(methodsText, MODEL_UNAVAILABLE_MESSAGE);

  const session = await createLanguageModelSession({
    systemPrompt: "You are a clinical trial methodologist. Output valid JSON.",
    temperature: 0.4,
    topK: 12
  }, "en");

  if (!session) {
    return fallback;
  }

  try {
    const prompt = buildMethodologyPrompt({ methodsText, fullText });
    const response = await session.prompt(prompt);
    const parsed = safeJsonParse(response);

    if (!parsed) {
      throw new Error("Language model returned invalid JSON.");
    }

    return {
      source: "chrome-ai-language-model",
      generatedAt: new Date().toISOString(),
      data: parsed
    };
  } catch (error) {
    console.warn("MedLit: falling back for methodology assessment", error);
    return {
      ...fallback,
      warning: error.message
    };
  } finally {
    destroySession(session);
  }
}

/**
 * Simplifies complex medical text into plain English
 * @param {string} text - The medical text to simplify
 * @returns {Promise<Object>} Simplified text with key terms and statistics notes
 * @throws {Error} If no text is provided
 */
export async function simplifyMedicalText(text) {
  const trimmed = text?.trim();
  if (!trimmed) {
    throw new Error("No text provided for simplification.");
  }

  if (typeof Rewriter !== 'undefined') {
    try {
      const available = await Rewriter.availability();
      if (available !== 'unavailable') {
        const rewriterOptions = {
          tone: "more-casual",
          length: "as-is",
          sharedContext: "Explain advanced medical research concepts to trainees"
        };
        
        let rewriter;
        try {
          // Try with outputLanguage parameter first (newer API format)
          rewriter = await Rewriter.create({ ...rewriterOptions, outputLanguage: "en" });
        } catch (langError) {
          // If outputLanguage not supported, try language parameter
          try {
            rewriter = await Rewriter.create({ ...rewriterOptions, language: "en" });
          } catch (altError) {
            // If neither works, try without language parameter
            console.debug("MedLit: Rewriter language parameters not supported, using default");
            rewriter = await Rewriter.create(rewriterOptions);
          }
        }
        
        const rewritten = await rewriter.rewrite(trimmed);
        destroySession(rewriter);
        return {
          source: "chrome-ai-rewriter",
          generatedAt: new Date().toISOString(),
          data: {
            plainEnglish: rewritten,
            keyTerms: [],
            statisticsNotes: []
          }
        };
      }
    } catch (error) {
      console.warn("MedLit: rewriter unavailable, falling back to language model", error);
    }
  }

  const session = await createLanguageModelSession({
    systemPrompt:
      "You are a medical educator simplifying complex research passages. Output valid JSON matching the provided schema.",
    temperature: 0.35,
    topK: 12
  }, "en");

  if (!session) {
    return createFallbackSimplification(trimmed, MODEL_UNAVAILABLE_MESSAGE);
  }

  try {
    const prompt = buildSimplificationPrompt(trimmed);
    const response = await session.prompt(prompt);
    const parsed = safeJsonParse(response);
    if (!parsed) {
      throw new Error("Language model returned invalid JSON.");
    }

    return {
      source: "chrome-ai-language-model",
      generatedAt: new Date().toISOString(),
      data: parsed
    };
  } catch (error) {
    console.warn("MedLit: falling back for simplification", error);
    return {
      ...createFallbackSimplification(trimmed, MODEL_UNAVAILABLE_MESSAGE),
      warning: error.message
    };
  } finally {
    destroySession(session);
  }
}

/**
 * Translates medical text to English
 * @param {string} text - The text to translate
 * @param {string} [detectedLanguage] - Optional detected source language code
 * @returns {Promise<Object>} Translated text with source language information
 * @throws {Error} If no text is provided
 */
export async function translateToEnglish(text, detectedLanguage) {
  const trimmed = text?.trim();
  if (!trimmed) {
    throw new Error("No text provided for translation.");
  }

  if (typeof Translator !== 'undefined') {
    try {
      const sourceLanguage = detectedLanguage || "en"; // Translator requires explicit source language
      const available = await Translator.availability({
        sourceLanguage,
        targetLanguage: "en"
      });
      
      if (available !== 'unavailable') {
        const translator = await Translator.create({
          sourceLanguage,
          targetLanguage: "en"
        });

        const translated = await translator.translate(trimmed);
        destroySession(translator);
        return {
          source: "chrome-ai-translation",
          generatedAt: new Date().toISOString(),
          data: {
            translatedText: translated,
            detectedLanguage: sourceLanguage
          }
        };
      }
    } catch (error) {
      console.warn("MedLit: translator unavailable, falling back to language model", error);
    }
  }

  const session = await createLanguageModelSession({
    systemPrompt:
      "You are a medical translator. Translate input text to English while preserving clinical terminology. Respond in valid JSON.",
    temperature: 0.2,
    topK: 10
  }, "en");

  if (!session) {
    return createFallbackTranslation(trimmed, detectedLanguage, MODEL_UNAVAILABLE_MESSAGE);
  }

  try {
    const prompt = `
Translate the following medical text to English.
Respond with JSON: {"translatedText": "...", "notes": ["string"]}

TEXT:
${trimmed}
`.trim();
    const response = await session.prompt(prompt);
    const parsed = safeJsonParse(response);
    if (!parsed) {
      throw new Error("Language model returned invalid JSON.");
    }

    return {
      source: "chrome-ai-language-model",
      generatedAt: new Date().toISOString(),
      data: {
        translatedText: parsed.translatedText || trimmed,
        detectedLanguage: detectedLanguage || "unknown",
        notes: parsed.notes || []
      }
    };
  } catch (error) {
    console.warn("MedLit: falling back for translation", error);
    return {
      ...createFallbackTranslation(trimmed, detectedLanguage, MODEL_UNAVAILABLE_MESSAGE),
      warning: error.message
    };
  } finally {
    destroySession(session);
  }
}

/**
 * Builds key points from a summary for export purposes
 * @param {string} summaryMarkdown - The summary in Markdown format
 * @param {string} fullText - The full paper text
 * @returns {Promise<Object>} Key points structured for export
 */
export async function buildKeyPointsExport(summaryMarkdown, fullText) {
  const session = await createLanguageModelSession({
    systemPrompt: "You structure medical study highlights for export. Output valid JSON.",
    temperature: 0.35,
    topK: 12
  }, "en");

  if (!session) {
    return createFallbackKeyPoints(fullText);
  }

  try {
    const prompt = buildKeyPointsPrompt(summaryMarkdown, fullText);
    const response = await session.prompt(prompt);
    const parsed = safeJsonParse(response);
    if (!parsed) {
      throw new Error("Language model returned invalid JSON.");
    }

    return {
      source: "chrome-ai-language-model",
      generatedAt: new Date().toISOString(),
      data: parsed
    };
  } catch (error) {
    console.warn("MedLit: falling back for key points export", error);
    return {
      ...createFallbackKeyPoints(fullText),
      warning: error.message
    };
  } finally {
    destroySession(session);
  }
}

export async function detectStudyType(documentSnapshot) {
  // Lightweight session for classification; safe to return null on failure
  const session = await createLanguageModelSession({
    systemPrompt: "You classify medical study type and appropriate framework. Output valid JSON only.",
    temperature: 0.1,
    topK: 8
  }, "en");

  if (!session) {
    return null;
  }

  try {
    const prompt = buildStudyTypePrompt(documentSnapshot);
    const response = await session.prompt(prompt);
    const parsed = safeJsonParse(response);
    if (!parsed) {
      throw new Error("Invalid JSON from classifier");
    }
    
    // Normalize study type and framework to handle variations
    let studyType = normalizeStudyType(parsed.studyType);
    let framework = normalizeFramework(parsed.framework);
    
    // Fallback heuristic: if classifier returned "Other"/"None" but reasons contain clear keywords, override
    if (studyType === "Other" || framework === "None") {
      const reasonsText = Array.isArray(parsed.reasons) ? parsed.reasons.join(' ').toLowerCase() : '';
      console.log('MedLit: Applying heuristic fallback. Reasons:', reasonsText.substring(0, 200));
      const override = inferFromReasons(reasonsText);
      console.log('MedLit: Heuristic override result:', override);
      if (override.studyType && studyType === "Other") {
        console.log(`MedLit: Overriding studyType from "Other" to "${override.studyType}"`);
        studyType = override.studyType;
      }
      if (override.framework && framework === "None") {
        console.log(`MedLit: Overriding framework from "None" to "${override.framework}"`);
        framework = override.framework;
      }
    }
    
    // Additional fallback: if studyType is known but framework is still None, infer from study type
    if (framework === "None" && studyType !== "Other") {
      const inferredFramework = inferFrameworkFromStudyType(studyType);
      if (inferredFramework !== "None") {
        console.log(`MedLit: Inferring framework "${inferredFramework}" from studyType "${studyType}"`);
        framework = inferredFramework;
      }
    }
    
    return {
      source: "chrome-ai-language-model",
      generatedAt: new Date().toISOString(),
      data: {
        studyType,
        framework,
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : null,
        reasons: Array.isArray(parsed.reasons) ? parsed.reasons : []
      }
    };
  } catch (error) {
    console.debug("MedLit: study type classification failed", error);
    return null;
  } finally {
    destroySession(session);
  }
}

function normalizeStudyType(value) {
  if (!value || typeof value !== 'string') return "Other";
  const normalized = value.trim().toLowerCase();
  
  // Map common variations to canonical values
  if (normalized.includes('rct') || normalized.includes('randomized controlled') || 
      normalized.includes('clinical trial') || normalized.includes('randomised')) {
    return "RCT";
  }
  if (normalized.includes('cohort')) return "Cohort";
  if (normalized.includes('case-control') || normalized.includes('case control')) return "Case-Control";
  if (normalized.includes('cross-sectional') || normalized.includes('cross sectional')) return "Cross-Sectional";
  if (normalized.includes('systematic review')) return "Systematic Review";
  if (normalized.includes('meta-analysis') || normalized.includes('metaanalysis')) return "Meta-Analysis";
  if (normalized.includes('diagnostic accuracy') || normalized.includes('diagnostic test')) return "Diagnostic Accuracy";
  if (normalized.includes('case report')) return "Case Report";
  if (normalized.includes('case series')) return "Case Series";
  if (normalized.includes('qualitative')) return "Qualitative";
  if (normalized.includes('basic science') || normalized.includes('bench') || 
      normalized.includes('in vitro') || normalized.includes('in vivo')) {
    return "Basic Science";
  }
  
  // Return as-is if it matches canonical values exactly
  const canonical = ["RCT", "Cohort", "Case-Control", "Cross-Sectional", "Systematic Review", 
                     "Meta-Analysis", "Diagnostic Accuracy", "Case Report", "Case Series", 
                     "Qualitative", "Basic Science", "Other"];
  if (canonical.includes(value.trim())) return value.trim();
  
  return "Other";
}

function normalizeFramework(value) {
  if (!value || typeof value !== 'string') return "None";
  const normalized = value.trim().toUpperCase();
  
  // Map to canonical values
  const canonical = ["CONSORT", "STROBE", "PRISMA", "STARD", "CARE", "COREQ", "PICO", "None"];
  if (canonical.includes(normalized)) return normalized;
  
  // Handle common variations
  if (normalized.includes('CONSORT')) return "CONSORT";
  if (normalized.includes('STROBE')) return "STROBE";
  if (normalized.includes('PRISMA')) return "PRISMA";
  if (normalized.includes('STARD')) return "STARD";
  if (normalized.includes('CARE')) return "CARE";
  if (normalized.includes('COREQ')) return "COREQ";
  if (normalized.includes('PICO')) return "PICO";
  
  return "None";
}

function inferFrameworkFromStudyType(studyType) {
  // Map study type to appropriate framework
  const mapping = {
    "RCT": "CONSORT",
    "Cohort": "STROBE",
    "Case-Control": "STROBE",
    "Cross-Sectional": "STROBE",
    "Systematic Review": "PRISMA",
    "Meta-Analysis": "PRISMA",
    "Diagnostic Accuracy": "STARD",
    "Case Report": "CARE",
    "Case Series": "CARE",
    "Qualitative": "COREQ",
    "Basic Science": "None",
    "Other": "None"
  };
  return mapping[studyType] || "None";
}

function inferFromReasons(reasonsText) {
  // Extract study type and framework from reasoning text when classifier output is ambiguous
  const result = { studyType: null, framework: null };
  
  if (!reasonsText) return result;
  
  // Check for study type keywords in reasons
  if (reasonsText.includes('randomized') || reasonsText.includes('randomised') || 
      reasonsText.includes('rct') || reasonsText.includes('clinical trial') || 
      reasonsText.includes('phase 2') || reasonsText.includes('phase 3') || 
      reasonsText.includes('phase ii') || reasonsText.includes('phase iii')) {
    result.studyType = "RCT";
  } else if (reasonsText.includes('systematic review')) {
    result.studyType = "Systematic Review";
  } else if (reasonsText.includes('meta-analysis') || reasonsText.includes('metaanalysis')) {
    result.studyType = "Meta-Analysis";
  } else if (reasonsText.includes('cohort study') || reasonsText.includes('cohort design')) {
    result.studyType = "Cohort";
  } else if (reasonsText.includes('case-control') || reasonsText.includes('case control')) {
    result.studyType = "Case-Control";
  } else if (reasonsText.includes('cross-sectional') || reasonsText.includes('cross sectional')) {
    result.studyType = "Cross-Sectional";
  } else if (reasonsText.includes('diagnostic accuracy') || 
             (reasonsText.includes('sensitivity') && reasonsText.includes('specificity'))) {
    result.studyType = "Diagnostic Accuracy";
  } else if (reasonsText.includes('case report')) {
    result.studyType = "Case Report";
  } else if (reasonsText.includes('case series')) {
    result.studyType = "Case Series";
  } else if (reasonsText.includes('qualitative')) {
    result.studyType = "Qualitative";
  } else if (reasonsText.includes('in vitro') || reasonsText.includes('in vivo') || 
             reasonsText.includes('animal model') || reasonsText.includes('bench')) {
    result.studyType = "Basic Science";
  }
  
  // Check for framework keywords in reasons
  if (reasonsText.includes('consort')) {
    result.framework = "CONSORT";
  } else if (reasonsText.includes('strobe')) {
    result.framework = "STROBE";
  } else if (reasonsText.includes('prisma')) {
    result.framework = "PRISMA";
  } else if (reasonsText.includes('stard')) {
    result.framework = "STARD";
  } else if (reasonsText.includes('care guideline') || reasonsText.includes('care framework')) {
    result.framework = "CARE";
  } else if (reasonsText.includes('coreq')) {
    result.framework = "COREQ";
  } else if (reasonsText.includes('pico')) {
    result.framework = "PICO";
  }
  
  return result;
}

async function createLanguageModelSession(options, language = "en") {
  if (typeof LanguageModel === 'undefined') {
    return null;
  }

  try {
    const available = await LanguageModel.availability();
    if (available === 'unavailable') {
      return null;
    }
    
    // Per Prompt API docs: specify expected inputs/outputs with explicit language arrays
    const sessionOptions = {};
    
    if (options.temperature !== undefined) {
      sessionOptions.temperature = options.temperature;
    }
    if (options.topK !== undefined) {
      sessionOptions.topK = options.topK;
    }
    
    // Convert systemPrompt to initialPrompts format
    if (options.systemPrompt) {
      sessionOptions.initialPrompts = [
        { role: "system", content: options.systemPrompt }
      ];
    }
    
    // MUST specify expectedOutputs per API docs to avoid "No output language" warning
    sessionOptions.expectedInputs = [
      { type: "text", languages: [language] }
    ];
    sessionOptions.expectedOutputs = [
      { type: "text", languages: [language] }
    ];
    
    return await LanguageModel.create(sessionOptions);
  } catch (error) {
    console.warn("MedLit: unable to create language model session", error);
    return null;
  }
}

function destroySession(session) {
  if (!session) {
    return;
  }

  try {
    if (typeof session.destroy === "function") {
      session.destroy();
    } else if (typeof session.close === "function") {
      session.close();
    }
  } catch (error) {
    console.debug("MedLit: failed to clean up AI session", error);
  }
}

function safeJsonParse(payload) {
  if (!payload) {
    return null;
  }

  try {
    let text = typeof payload === "string" ? payload.trim() : payload;
    
    // If it's already an object, return it
    if (typeof text !== "string") {
      return text;
    }
    
    // Strip markdown code blocks (```json ... ``` or ``` ... ```)
    text = text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
    
    return JSON.parse(text);
  } catch (error) {
    console.warn("MedLit: JSON parse error", error);
    return null;
  }
}

