import {
  buildKeyPointsPrompt,
  buildMethodologyPrompt,
  buildSimplificationPrompt,
  buildStructuredSummaryPrompt
} from "./promptTemplates.js";

const MODEL_UNAVAILABLE_MESSAGE =
  "Chrome on-device AI is not available. Showing heuristic preview instead.";

export async function generateStructuredSummary(documentSnapshot) {
  const fallback = createFallbackSummary(documentSnapshot, MODEL_UNAVAILABLE_MESSAGE);

  const session = await createLanguageModelSession({
    systemPrompt: "You are a medical research analyst. Output strictly valid JSON.",
    temperature: 0.3,
    topK: 10
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

export async function evaluateMethodology({ methodsText, fullText }) {
  const fallback = createFallbackMethodology(methodsText, MODEL_UNAVAILABLE_MESSAGE);

  const session = await createLanguageModelSession({
    systemPrompt: "You are a clinical trial methodologist. Output valid JSON.",
    temperature: 0.4,
    topK: 12
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
          sharedContext: "Explain advanced medical research concepts to trainees"
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
    topK: 12
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

export async function buildKeyPointsExport(summaryMarkdown, fullText) {
  const session = await createLanguageModelSession({
    systemPrompt: "You structure medical study highlights for export. Output valid JSON.",
    temperature: 0.35,
    topK: 12
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
    const trimmed = typeof payload === "string" ? payload.trim() : payload;
    return typeof trimmed === "string" ? JSON.parse(trimmed) : trimmed;
  } catch (error) {
    console.warn("MedLit: JSON parse error", error);
    return null;
  }
}

function createFallbackSummary(documentSnapshot, message) {
  const text = (documentSnapshot?.article?.textContent ?? "").replace(/\s+/g, " ").trim();
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  const sampleSentences = sentences.slice(0, 3);

  return {
    source: "fallback",
    generatedAt: new Date().toISOString(),
    message,
    data: {
      studyDesign: {
        type: "Unknown",
        setting: "Not detected",
        studyPeriod: "Not detected",
        registrationID: null
      },
      population: {
        sampleSize: { intervention: null, control: null, total: null },
        demographics: { age: "Not detected", gender: "Not detected", ethnicity: "Not detected" },
        inclusionCriteria: [],
        exclusionCriteria: []
      },
      intervention: {
        description: "Pending analysis",
        dosage: "Pending analysis",
        duration: "Pending analysis"
      },
      comparison: {
        controlType: "Not detected",
        description: "Pending analysis"
      },
      outcomes: {
        primary: {
          measure: "Pending analysis",
          interventionResult: "Pending analysis",
          controlResult: "Pending analysis",
          pValue: null,
          confidenceInterval: "Pending analysis",
          effectSize: "Pending analysis"
        },
        secondary: []
      },
      interpretation: {
        NNT: null,
        interpretation:
          sampleSentences.length > 0
            ? sampleSentences.join(" ")
            : "Review the study details once Chrome AI is available.",
        limitations: [],
        applicability: "Pending analysis"
      }
    }
  };
}

function createFallbackMethodology(methodsText, message) {
  const cleanText = (methodsText ?? "").replace(/\s+/g, " ").trim();
  const excerpt = cleanText.slice(0, 360);

  return {
    source: "fallback",
    generatedAt: new Date().toISOString(),
    message,
    data: {
      researchQuestionClarity: {
        score: 3,
        strengths: ["AI model unavailable; review manually."],
        concerns: []
      },
      sampleSizePower: {
        score: 3,
        calculated: null,
        actual: null,
        assessment: "Unable to estimate power without AI support."
      },
      randomization: {
        score: 2,
        method: "Not assessed",
        concerns: []
      },
      blinding: {
        participants: false,
        assessors: false,
        analysts: false,
        concerns: ["No automated assessment available."]
      },
      statisticalApproach: {
        score: 3,
        methods: [],
        strengths: [],
        concerns: ["Pending AI-driven review."]
      },
      overallQualityScore: 50,
      keyLimitations: [
        "MedLit could not evaluate the methodology automatically. Review methods manually."
      ],
      recommendation: excerpt
        ? `Review methods manually. Excerpt: ${excerpt}${cleanText.length > 360 ? "…" : ""}`
        : "Review methods manually once AI is available."
    }
  };
}

function createFallbackSimplification(text, message) {
  return {
    source: "fallback",
    generatedAt: new Date().toISOString(),
    message,
    data: {
      plainEnglish: text,
      keyTerms: [],
      statisticsNotes: []
    }
  };
}

function createFallbackTranslation(text, detectedLanguage, message) {
  return {
    source: "fallback",
    generatedAt: new Date().toISOString(),
    message,
    data: {
      translatedText: text,
      detectedLanguage: detectedLanguage || "unknown",
      notes: ["Translation preview only. Chrome AI translator unavailable."]
    }
  };
}

function createFallbackKeyPoints(fullText) {
  const sentences = (fullText ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean)
    .slice(0, 5);

  return {
    source: "fallback",
    generatedAt: new Date().toISOString(),
    message: MODEL_UNAVAILABLE_MESSAGE,
    data: {
      keyHypothesis: sentences.slice(0, 1),
      criticalFindings: sentences.slice(1, 3),
      studyLimitations: ["Manual review required."],
      implications: ["Await AI analysis for actionable points."],
      futureResearch: ["Identify future directions once AI summary is ready."]
    }
  };
}
