/**
 * Context menu identifiers
 */
export const CONTEXT_MENUS = {
  summarize: "medlit_context_summarize",
  methodology: "medlit_context_methodology",
  simplify: "medlit_context_simplify",
  translate: "medlit_context_translate"
};

/**
 * Message type constants
 */
export const MESSAGE_TYPES = {
  REQUEST_DOCUMENT: "medlit:request-document",
  REQUEST_LAST_SELECTION: "medlit:request-last-selection",
  GET_DOCUMENT_CONTENTS: "medlit:get-document-contents",
  GET_LAST_SELECTION: "medlit:get-last-selection",
  CONTEXT_SUMMARIZE: "medlit:context-summarize",
  CONTEXT_METHODOLOGY: "medlit:context-methodology",
  CONTEXT_SIMPLIFY: "medlit:context-simplify",
  CONTEXT_TRANSLATE: "medlit:context-translate"
};

/**
 * Message source identifier
 */
export const MESSAGE_SOURCE = {
  SERVICE_WORKER: "medlit-service-worker"
};

/**
 * Common error messages
 */
export const ERROR_MESSAGES = {
  NO_ACTIVE_TAB: "No active tab available",
  NO_TEXT_PROVIDED: "No text provided",
  UNABLE_TO_ACCESS_CONTENT: "Unable to access page content. Make sure MedLit is allowed on this site.",
  UNABLE_TO_READ_SELECTION: "Unable to read selection. Try reloading the page.",
  EXTENSION_MESSAGING_FAILED: "Extension messaging failed."
};

/**
 * AI model unavailability message
 */
export const MODEL_UNAVAILABLE_MESSAGE =
  "Chrome on-device AI is not available. Showing heuristic preview instead.";
