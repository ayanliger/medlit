import { MODEL_UNAVAILABLE_MESSAGE } from "../shared/constants.js";

/**
 * Creates a fallback structured summary when AI is unavailable
 * @param {Object} documentSnapshot - The document snapshot containing article content
 * @param {string} message - Optional custom message
 * @returns {Object} Fallback summary object
 */
export function createFallbackSummary(documentSnapshot, message = MODEL_UNAVAILABLE_MESSAGE) {
  // Return error state instead of fake data - this extension REQUIRES Chrome built-in AI
  return {
    source: "error",
    generatedAt: new Date().toISOString(),
    error: true,
    message,
    userMessage: "Chrome Built-in AI is required for MedLit to function. Please enable it in chrome://flags/#optimization-guide-on-device-model",
    data: null
  };
}

/**
 * Creates a fallback methodology assessment when AI is unavailable
 * @param {string} methodsText - The methods section text
 * @param {string} message - Optional custom message
 * @returns {Object} Fallback methodology object
 */
export function createFallbackMethodology(methodsText, message = MODEL_UNAVAILABLE_MESSAGE) {
  // Return error state instead of fake scores
  return {
    source: "error",
    generatedAt: new Date().toISOString(),
    error: true,
    message,
    userMessage: "Chrome Built-in AI is required for methodology assessment. Please enable it in chrome://flags/#optimization-guide-on-device-model",
    data: null
  };
}

/**
 * Creates a fallback simplification when AI is unavailable
 * @param {string} text - The text to simplify
 * @param {string} message - Optional custom message
 * @returns {Object} Fallback simplification object
 */
export function createFallbackSimplification(text, message = MODEL_UNAVAILABLE_MESSAGE) {
  // Return error state - don't return original text as "simplified"
  return {
    source: "error",
    generatedAt: new Date().toISOString(),
    error: true,
    message,
    userMessage: "Chrome Built-in AI (Rewriter API) is required for text simplification. Please enable it in chrome://flags/#optimization-guide-on-device-model",
    data: null
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
  // Return error state - don't return untranslated text as "translated"
  return {
    source: "error",
    generatedAt: new Date().toISOString(),
    error: true,
    message,
    userMessage: "Chrome Built-in AI (Translator API) is required for translation. Please enable it in chrome://flags/#optimization-guide-on-device-model",
    data: null
  };
}

/**
 * Creates fallback key points for export when AI is unavailable
 * @param {string} fullText - The full paper text
 * @returns {Object} Fallback key points object
 */
export function createFallbackKeyPoints(fullText) {
  // Return error state instead of arbitrary sentence extraction
  return {
    source: "error",
    generatedAt: new Date().toISOString(),
    error: true,
    message: MODEL_UNAVAILABLE_MESSAGE,
    userMessage: "Chrome Built-in AI is required for key points extraction. Please enable it in chrome://flags/#optimization-guide-on-device-model",
    data: null
  };
}
