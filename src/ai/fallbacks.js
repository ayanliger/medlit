import { MODEL_UNAVAILABLE_MESSAGE } from "../shared/constants.js";

/**
 * Creates a fallback structured summary when AI is unavailable
 * @param {Object} documentSnapshot - The document snapshot containing article content
 * @param {string} message - Optional custom message
 * @returns {Object} Fallback summary object
 */
export function createFallbackSummary(documentSnapshot, message = MODEL_UNAVAILABLE_MESSAGE) {
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

/**
 * Creates a fallback methodology assessment when AI is unavailable
 * @param {string} methodsText - The methods section text
 * @param {string} message - Optional custom message
 * @returns {Object} Fallback methodology object
 */
export function createFallbackMethodology(methodsText, message = MODEL_UNAVAILABLE_MESSAGE) {
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

/**
 * Creates a fallback simplification when AI is unavailable
 * @param {string} text - The text to simplify
 * @param {string} message - Optional custom message
 * @returns {Object} Fallback simplification object
 */
export function createFallbackSimplification(text, message = MODEL_UNAVAILABLE_MESSAGE) {
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

/**
 * Creates a fallback translation when AI is unavailable
 * @param {string} text - The text to translate
 * @param {string} detectedLanguage - The detected source language
 * @param {string} message - Optional custom message
 * @returns {Object} Fallback translation object
 */
export function createFallbackTranslation(text, detectedLanguage, message = MODEL_UNAVAILABLE_MESSAGE) {
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

/**
 * Creates fallback key points for export when AI is unavailable
 * @param {string} fullText - The full paper text
 * @returns {Object} Fallback key points object
 */
export function createFallbackKeyPoints(fullText) {
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
