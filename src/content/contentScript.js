// Content scripts cannot use ES6 imports in Chrome extensions
// Constants are inlined here for compatibility
const MESSAGE_TYPES = {
  GET_DOCUMENT_CONTENTS: "medlit:get-document-contents",
  GET_LAST_SELECTION: "medlit:get-last-selection"
};

const state = {
  lastSelection: "",
  lastSelectionTimestamp: 0
};

document.addEventListener("selectionchange", () => {
  const selection = window.getSelection();
  const text = selection ? selection.toString().trim() : "";
  if (!text) {
    return;
  }

  state.lastSelection = text;
  state.lastSelectionTimestamp = Date.now();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message?.type?.startsWith("medlit:")) {
    return;
  }

  try {
    switch (message.type) {
      case MESSAGE_TYPES.GET_DOCUMENT_CONTENTS: {
        sendResponse(collectDocumentSnapshot());
        break;
      }
      case MESSAGE_TYPES.GET_LAST_SELECTION: {
        sendResponse({
          text: state.lastSelection,
          capturedAt: state.lastSelectionTimestamp
        });
        break;
      }
      default:
        break;
    }
  } catch (error) {
    console.error("MedLit: Content script error", error);
    sendResponse({ error: error.message });
  }
  
  // Signal that we might respond synchronously.
  return true;
});

function collectDocumentSnapshot() {
  const title = document.title;
  const meta = {
    url: window.location.href,
    title,
    metaDescription: document.querySelector("meta[name='description']")?.content || "",
    metaKeywords: document.querySelector("meta[name='keywords']")?.content || ""
  };

  const article = extractMainArticle();

  return {
    meta,
    article
  };
}

function extractMainArticle() {
  const articleElement = document.querySelector("article") || document.body;
  return {
    textContent: articleElement.innerText || "",
    htmlContent: articleElement.innerHTML || ""
  };
}
