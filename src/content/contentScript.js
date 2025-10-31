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
  let title = document.title;
  const url = window.location.href;
  
  // For PDFs, document.title is just the filename
  // Extract actual title from the first text content
  const isPDF = url.toLowerCase().endsWith('.pdf') || document.contentType === 'application/pdf';
  
  const article = extractMainArticle();
  
  if (isPDF && article.textContent) {
    // Extract first significant line as title (usually the paper title)
    const lines = article.textContent.split('\n').map(l => l.trim()).filter(Boolean);
    
    // Find the first substantial line (more than 20 chars, likely the title)
    const potentialTitle = lines.find(line => 
      line.length > 20 && 
      line.length < 300 && 
      !line.toLowerCase().startsWith('http') &&
      !line.match(/^\d+$/) // not just a page number
    );
    
    if (potentialTitle) {
      title = potentialTitle;
      console.log('MedLit: Extracted PDF title:', title.substring(0, 100));
    }
  }
  
  const meta = {
    url,
    title,
    metaDescription: document.querySelector("meta[name='description']")?.content || "",
    metaKeywords: document.querySelector("meta[name='keywords']")?.content || ""
  };

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
