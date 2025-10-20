const CONTEXT_MENUS = {
  methodology: "medlit_context_methodology",
  simplify: "medlit_context_simplify",
  translate: "medlit_context_translate"
};

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

  await chrome.sidePanel.setOptions({
    tabId: tab.id,
    path: "src/sidepanel/index.html"
  });

  await chrome.sidePanel.open({ tabId: tab.id });
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
    source: "medlit-service-worker"
  });
  chrome.tabs.sendMessage(tab.id, message, () => {
    chrome.runtime.lastError; // Suppress if no listener in tab
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message?.type?.startsWith("medlit:")) {
    return;
  }

  if (message?.source === "medlit-service-worker") {
    return;
  }

  switch (message.type) {
    case "medlit:request-document": {
      handleDocumentRequest()
        .then((documentSnapshot) => sendResponse({ ok: true, document: documentSnapshot }))
        .catch((error) => {
          console.error("MedLit document request failed", error);
          sendResponse({ ok: false, error: error.message || String(error) });
        });
      return true;
    }
    case "medlit:request-last-selection": {
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
    throw new Error("No active tab available");
  }

  try {
    return await chrome.tabs.sendMessage(tab.id, { type: "medlit:get-document-contents" });
  } catch (error) {
    throw new Error("Unable to access page content. Make sure MedLit is allowed on this site.");
  }
}

async function handleLastSelectionRequest() {
  const tab = await getActiveTab();
  if (!tab?.id) {
    throw new Error("No active tab available");
  }

  try {
    return await chrome.tabs.sendMessage(tab.id, { type: "medlit:get-last-selection" });
  } catch (error) {
    throw new Error("Unable to read selection. Try reloading the page.");
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
    id: CONTEXT_MENUS.methodology,
    title: "MedLit: Scan Methodology",
    contexts: ["selection"]
  });

  chrome.contextMenus.create({
    id: CONTEXT_MENUS.simplify,
    title: "MedLit: Simplify Medical Jargon",
    contexts: ["selection"]
  });

  chrome.contextMenus.create({
    id: CONTEXT_MENUS.translate,
    title: "MedLit: Translate Abstract",
    contexts: ["selection"]
  });
}

function buildContextMenuMessage(info) {
  if (!info.selectionText) {
    return null;
  }

  switch (info.menuItemId) {
    case CONTEXT_MENUS.methodology:
      return {
        type: "medlit:context-methodology",
        payload: { text: info.selectionText }
      };
    case CONTEXT_MENUS.simplify:
      return {
        type: "medlit:context-simplify",
        payload: { text: info.selectionText }
      };
    case CONTEXT_MENUS.translate:
      return {
        type: "medlit:context-translate",
        payload: { text: info.selectionText, detectedLanguage: info.selectionTextLanguage }
      };
    default:
      return null;
  }
}
