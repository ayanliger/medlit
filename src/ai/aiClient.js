import {
  buildKeyPointsPrompt,
  buildMethodologyPrompt,
  buildSimplificationPrompt,
  buildStructuredSummaryPrompt
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
 * Generates a structured PICO summary of a medical research paper
 * @param {Object} documentSnapshot - Document snapshot containing meta and article content
 * @param {Object} documentSnapshot.meta - Document metadata (title, URL, etc.)
 * @param {Object} documentSnapshot.article - Article content
 * @returns {Promise<Object>} Structured summary with PICO framework data
 */
export async function generateStructuredSummary(documentSnapshot) {
  const fallback = createFallbackSummary(documentSnapshot, MODEL_UNAVAILABLE_MESSAGE);

  const session = await createLanguageModelSession({
    systemPrompt: "You are a medical research analyst. Output strictly valid JSON.",
    temperature: 0.3,
    topK: 10,
    language: "en"
  });

  if (!session) {
    return fallback;
  }

  try {
    const prompt = buildStructuredSummaryPrompt(documentSnapshot);
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
    console.warn("MedLit: falling back for structured summary", error);
    return {
      ...fallback,
      warning: error.message
    };
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
    topK: 12,
    language: "en"
  });

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
        const rewriter = await Rewriter.create({
          tone: "more-casual",
          length: "as-is",
          sharedContext: "Explain advanced medical research concepts to trainees",
          language: "en"
        });
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
    topK: 12,
    language: "en"
  });

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
    topK: 10,
    language: "en"
  });

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
    topK: 12,
    language: "en"
  });

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

async function createLanguageModelSession(options) {
  if (typeof LanguageModel === 'undefined') {
    return null;
  }

  try {
    const available = await LanguageModel.availability();
    if (available === 'unavailable') {
      return null;
    }
    return await LanguageModel.create(options);
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

