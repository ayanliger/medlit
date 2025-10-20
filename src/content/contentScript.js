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

  switch (message.type) {
    case "medlit:get-document-contents": {
      sendResponse(collectDocumentSnapshot());
      break;
    }
    case "medlit:get-last-selection": {
      sendResponse({
        text: state.lastSelection,
        capturedAt: state.lastSelectionTimestamp
      });
      break;
    }
    default:
      break;
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
