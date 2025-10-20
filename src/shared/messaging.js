import { ERROR_MESSAGES } from "./constants.js";

/**
 * Sends a message to the Chrome runtime
 * @param {string} type - The message type
 * @param {Object} [payload] - Optional message payload
 * @returns {Promise<any>} The response from the message handler
 * @throws {Error} If messaging fails
 */
export async function sendRuntimeMessage(type, payload) {
  try {
    return await chrome.runtime.sendMessage({ type, payload });
  } catch (error) {
    throw new Error(error?.message || ERROR_MESSAGES.EXTENSION_MESSAGING_FAILED);
  }
}

/**
 * Checks if a message is a MedLit message
 * @param {Object} message - The message to check
 * @returns {boolean} True if the message is a MedLit message
 */
export function isMedLitMessage(message) {
  return message?.type?.startsWith("medlit:");
}

/**
 * Checks if a message is from the service worker
 * @param {Object} message - The message to check
 * @param {string} serviceWorkerSource - The service worker source identifier
 * @returns {boolean} True if the message is from the service worker
 */
export function isFromServiceWorker(message, serviceWorkerSource) {
  return message?.source === serviceWorkerSource;
}
