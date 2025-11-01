import { CONTEXT_MENUS, MESSAGE_TYPES, MESSAGE_SOURCE, ERROR_MESSAGES } from "../shared/constants.js";

chrome.runtime.onInstalled.addListener(async () => {
  await setupContextMenus();
});

chrome.runtime.onStartup.addListener(async () => {
  await setupContextMenus();
});

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || tab.id < 0) {
    return;
  }

  try {
    await chrome.sidePanel.setOptions({
      tabId: tab.id,
      path: "src/sidepanel/index.html"
    });

    await chrome.sidePanel.open({ tabId: tab.id });
  } catch (error) {
    // Suppress error if side panel is already open or gesture timing issue
    // Side panel will still open on user action
    console.debug("MedLit: Side panel open info", error.message);
  }
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) {
    return;
  }

  const message = buildContextMenuMessage(info);
  if (!message) {
    return;
  }

  chrome.runtime.sendMessage({
    ...message,
    sourceTabId: tab.id,
    source: MESSAGE_SOURCE.SERVICE_WORKER
  });
  chrome.tabs.sendMessage(tab.id, message, () => {
    chrome.runtime.lastError; // Suppress if no listener in tab
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message?.type?.startsWith("medlit:")) {
    return;
  }

  if (message?.source === MESSAGE_SOURCE.SERVICE_WORKER) {
    return;
  }

  switch (message.type) {
    case MESSAGE_TYPES.REQUEST_DOCUMENT: {
      handleDocumentRequest()
        .then((documentSnapshot) => sendResponse({ ok: true, document: documentSnapshot }))
        .catch((error) => {
          console.error("MedLit document request failed", error);
          sendResponse({ ok: false, error: error.message || String(error) });
        });
      return true;
    }
    case MESSAGE_TYPES.REQUEST_LAST_SELECTION: {
      handleLastSelectionRequest()
        .then((selection) => sendResponse({ ok: true, selection }))
        .catch((error) => {
          console.error("MedLit selection request failed", error);
          sendResponse({ ok: false, error: error.message || String(error) });
        });
      return true;
    }
    default:
      break;
  }
});

async function handleDocumentRequest() {
  const tab = await getActiveTab();
  if (!tab?.id) {
    throw new Error(ERROR_MESSAGES.NO_ACTIVE_TAB);
  }

  try {
    return await chrome.tabs.sendMessage(tab.id, { type: MESSAGE_TYPES.GET_DOCUMENT_CONTENTS });
  } catch (error) {
    throw new Error(ERROR_MESSAGES.UNABLE_TO_ACCESS_CONTENT);
  }
}

async function handleLastSelectionRequest() {
  const tab = await getActiveTab();
  if (!tab?.id) {
    throw new Error(ERROR_MESSAGES.NO_ACTIVE_TAB);
  }

  try {
    return await chrome.tabs.sendMessage(tab.id, { type: MESSAGE_TYPES.GET_LAST_SELECTION });
  } catch (error) {
    throw new Error(ERROR_MESSAGES.UNABLE_TO_READ_SELECTION);
  }
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab;
}

async function setupContextMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.runtime.lastError; // Swallow errors when no menus exist
  });

  chrome.contextMenus.create({
    id: CONTEXT_MENUS.summarize,
    title: "Summarize from selection",
    contexts: ["selection"]
  });

  chrome.contextMenus.create({
    id: CONTEXT_MENUS.methodology,
    title: "Assess methodology from selection",
    contexts: ["selection"]
  });

  chrome.contextMenus.create({
    id: CONTEXT_MENUS.simplify,
    title: "Simplify language from selection",
    contexts: ["selection"]
  });

  chrome.contextMenus.create({
    id: CONTEXT_MENUS.translate,
    title: "Translate selection to English",
    contexts: ["selection"]
  });

  chrome.contextMenus.create({
    id: CONTEXT_MENUS.chat,
    title: "Chat with selection",
    contexts: ["selection"]
  });
}

function buildContextMenuMessage(info) {
  if (!info.selectionText) {
    return null;
  }

  switch (info.menuItemId) {
    case CONTEXT_MENUS.summarize:
      return {
        type: MESSAGE_TYPES.CONTEXT_SUMMARIZE,
        payload: { text: info.selectionText }
      };
    case CONTEXT_MENUS.methodology:
      return {
        type: MESSAGE_TYPES.CONTEXT_METHODOLOGY,
        payload: { text: info.selectionText }
      };
    case CONTEXT_MENUS.simplify:
      return {
        type: MESSAGE_TYPES.CONTEXT_SIMPLIFY,
        payload: { text: info.selectionText }
      };
    case CONTEXT_MENUS.translate:
      return {
        type: MESSAGE_TYPES.CONTEXT_TRANSLATE,
        payload: { text: info.selectionText, detectedLanguage: info.selectionTextLanguage }
      };
    case CONTEXT_MENUS.chat:
      return {
        type: MESSAGE_TYPES.CONTEXT_CHAT,
        payload: { text: info.selectionText }
      };
    default:
      return null;
  }
}
