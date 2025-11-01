import {
  buildKeyPointsExport,
  evaluateMethodology,
  generateStructuredSummary,
  simplifyMedicalText,
  translateToEnglish,
  createAISession
} from "../ai/aiClient.js";
import {
  renderStructuredSummary,
  renderMethodology,
  renderSimplification,
  renderTranslation,
  renderInfo,
  renderLoading,
  renderError
} from "./render.js";
import { sendRuntimeMessage } from "../shared/messaging.js";
import { MESSAGE_TYPES, MESSAGE_SOURCE } from "../shared/constants.js";

const statusEl = document.getElementById("statusMessage");
const picoOutputEl = document.getElementById("picoOutput");
const methodologyOutputEl = document.getElementById("methodologyOutput");
const simplifierOutputEl = document.getElementById("simplifierOutput");
const translationOutputEl = document.getElementById("translationOutput");
const exportBtn = document.getElementById("exportBtn");
const chatMessagesEl = document.getElementById("chatMessages");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const chatSendBtn = chatForm.querySelector(".chat-send-btn");
const clearChatBtn = document.getElementById("clearChatBtn");

const appState = {
  lastDocument: null,
  summary: null,
  methodology: null,
  simplifications: [],
  translations: [],
  chatHistory: [],
  chatContext: null // Stores the summarized text for chat context
};

const busyFlags = new Set();

document.getElementById("generateSummaryBtn").addEventListener("click", () => {
  void handleGenerateSummary({ forceRefresh: true });
});

document.getElementById("clearSummaryBtn").addEventListener("click", () => {
  handleClearSummary();
});

document.getElementById("settingsBtn").addEventListener("click", () => {
  openSettingsModal();
});

exportBtn.addEventListener("click", () => {
  openExportModal();
});

chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  void handleChatSubmit();
});

clearChatBtn.addEventListener("click", () => {
  handleClearChat();
});

document.getElementById("clearMethodologyBtn").addEventListener("click", () => {
  handleClearMethodology();
});

document.getElementById("clearSimplifierBtn").addEventListener("click", () => {
  handleClearSimplifier();
});

document.getElementById("clearTranslationBtn").addEventListener("click", () => {
  handleClearTranslation();
});

// Export modal event listeners
const exportModal = document.getElementById("exportModal");
const exportModalClose = document.getElementById("exportModalClose");
const exportModalOverlay = document.getElementById("exportModalOverlay");
const exportAllCheckbox = document.getElementById("exportAll");
const sectionCheckboxes = [
  document.getElementById("exportSummary"),
  document.getElementById("exportMethodology"),
  document.getElementById("exportSimplification"),
  document.getElementById("exportTranslation"),
  document.getElementById("exportChat")
];

exportModalClose.addEventListener("click", closeExportModal);
exportModalOverlay.addEventListener("click", closeExportModal);

exportAllCheckbox.addEventListener("change", (e) => {
  sectionCheckboxes.forEach(cb => {
    cb.checked = e.target.checked;
  });
});

document.getElementById("exportJson").addEventListener("click", () => {
  void handleExportFormat("json");
});

document.getElementById("exportMarkdown").addEventListener("click", () => {
  void handleExportFormat("md");
});

// Settings modal event listeners
const settingsModal = document.getElementById("settingsModal");
const settingsModalClose = document.getElementById("settingsModalClose");
const settingsModalOverlay = document.getElementById("settingsModalOverlay");
const saveSettingsBtn = document.getElementById("saveSettings");
const dyslexicOptions = document.getElementById("dyslexicOptions");
const letterSpacingSlider = document.getElementById("letterSpacingSlider");
const letterSpacingValue = document.getElementById("letterSpacingValue");
const fontSizeSlider = document.getElementById("fontSizeSlider");
const fontSizeValue = document.getElementById("fontSizeValue");

settingsModalClose.addEventListener("click", closeSettingsModal);
settingsModalOverlay.addEventListener("click", closeSettingsModal);
saveSettingsBtn.addEventListener("click", () => {
  void saveSettings();
});

// Show/hide dyslexic options based on font selection
document.querySelectorAll('input[name="font"]').forEach(radio => {
  radio.addEventListener("change", (e) => {
    if (e.target.value === "dyslexic") {
      dyslexicOptions.style.display = "flex";
    } else {
      dyslexicOptions.style.display = "none";
    }
  });
});

// Update slider values in real-time
letterSpacingSlider.addEventListener("input", (e) => {
  const value = parseFloat(e.target.value).toFixed(2);
  letterSpacingValue.textContent = `${value}em`;
});

fontSizeSlider.addEventListener("input", (e) => {
  fontSizeValue.textContent = `${e.target.value}px`;
});

chrome.runtime.onMessage.addListener((message) => {
  if (!message?.type?.startsWith("medlit:") || message?.source !== MESSAGE_SOURCE.SERVICE_WORKER) {
    return;
  }

  switch (message.type) {
    case MESSAGE_TYPES.CONTEXT_SUMMARIZE: {
      const text = message.payload?.text;
      if (!text) {
        renderError(picoOutputEl, "No text supplied for summary.");
        return;
      }
      void processSummaryFromSelection(text);
      break;
    }
    case MESSAGE_TYPES.CONTEXT_METHODOLOGY: {
      const text = message.payload?.text;
      if (!text) {
        renderError(methodologyOutputEl, "No text supplied from context menu.");
        return;
      }
      void processMethodology(text);
      break;
    }
    case MESSAGE_TYPES.CONTEXT_SIMPLIFY: {
      const text = message.payload?.text;
      if (!text) {
        renderError(simplifierOutputEl, "No text supplied for simplification.");
        return;
      }
      void processSimplification(text);
      break;
    }
    case MESSAGE_TYPES.CONTEXT_TRANSLATE: {
      const text = message.payload?.text;
      if (!text) {
        renderError(translationOutputEl, "No text supplied for translation.");
        return;
      }
      void processTranslation(text, message.payload?.detectedLanguage);
      break;
    }
    case MESSAGE_TYPES.CONTEXT_CHAT: {
      const text = message.payload?.text;
      if (!text) {
        updateStatus("No text supplied for chat.");
        return;
      }
      setChatContextFromSelection(text);
      break;
    }
    default:
      break;
  }
});

async function processSummaryFromSelection(text) {
  if (isBusy("summary")) {
    return;
  }

  setBusy("summary", true);
  renderLoading(picoOutputEl, "Generating summary from selection…");
  updateStatus("Analyzing selected text with Chrome AI…");

  try {
    // Create a minimal document snapshot using the selected text
    const documentSnapshot = {
      meta: {
        url: window.location.href || "",
        title: "" // Title will be extracted from text
      },
      article: {
        textContent: text,
        htmlContent: ""
      }
    };
    
    const summary = await generateStructuredSummary(documentSnapshot);
    appState.summary = summary;
    renderStructuredSummary(picoOutputEl, summary);
    
    // Enable chat after summary is generated
    enableChat(summary, documentSnapshot);
    
    updateStatus("Summary from selection ready.");
  } catch (error) {
    console.error("MedLit summary from selection error", error);
    renderError(picoOutputEl, error.message || "Unable to generate summary from selection.");
    updateStatus("Summary failed");
  } finally {
    setBusy("summary", false);
  }
}

async function handleGenerateSummary({ forceRefresh }) {
  if (isBusy("summary")) {
    return;
  }

  setBusy("summary", true);
  renderLoading(picoOutputEl, "Generating structured summary…");
  updateStatus("Collecting document and running Chrome AI…");

  try {
    const documentSnapshot = await getDocumentSnapshot(forceRefresh);
    const summary = await generateStructuredSummary(documentSnapshot);
    appState.summary = summary;
    
    // Check if it's a PDF with poor text extraction - show banner AFTER rendering summary
    const isPDF = documentSnapshot?.meta?.url?.toLowerCase().endsWith('.pdf');
    const hasMinimalTitle = !documentSnapshot?.meta?.title || 
                           documentSnapshot.meta.title.toLowerCase().endsWith('.pdf') ||
                           documentSnapshot.meta.title.length < 20;
    
    renderStructuredSummary(picoOutputEl, summary);
    
    // Enable chat after summary is generated
    enableChat(summary, documentSnapshot);
    
    // Show PDF notice for ALL PDFs (text extraction is always limited)
    if (isPDF) {
      const pdfBanner = `
        <div style="margin: 1em 0; padding: 1em; background: #1e293b; border-left: 4px solid #3b82f6; border-radius: 4px; color: #e2e8f0;">
          <p style="margin: 0 0 0.5em 0; font-weight: 600; color: #93c5fd;">📄 PDF Classification Note</p>
          <p style="margin: 0; font-size: 0.9em; line-height: 1.5;">Chrome's PDF viewer has limited text extraction capabilities. For the most accurate classification, use the <strong>context menu</strong> after selecting all text (Ctrl+A), or view the paper on the journal's website.</p>
        </div>
      `;
      picoOutputEl.insertAdjacentHTML('afterbegin', pdfBanner);
    }
    
    updateStatus(summary.source === "fallback" ? "Summary ready (fallback mode)." : "Summary ready.");
  } catch (error) {
    console.error("MedLit summary error", error);
    renderError(picoOutputEl, error.message || "Unable to produce summary.");
    updateStatus("Summary failed");
  } finally {
    setBusy("summary", false);
  }
}

async function processMethodology(methodsText) {
  if (isBusy("methodology")) {
    return;
  }

  setBusy("methodology", true);
  renderLoading(methodologyOutputEl, "Scanning methodology using Chrome AI…");
  updateStatus("Evaluating methodology rigor…");

  try {
    const documentSnapshot = await getDocumentSnapshot(false);
    const fullText = documentSnapshot?.article?.textContent ?? "";
    const result = await evaluateMethodology({ methodsText, fullText });
    appState.methodology = result;
    renderMethodology(methodologyOutputEl, result);
    updateStatus(result.source === "fallback" ? "Methodology preview ready (fallback)." : "Methodology assessment ready.");
  } catch (error) {
    console.error("MedLit methodology error", error);
    renderError(methodologyOutputEl, error.message || "Unable to analyze methodology.");
    updateStatus("Methodology scan failed");
  } finally {
    setBusy("methodology", false);
  }
}

async function processSimplification(text) {
  if (isBusy("simplification")) {
    return;
  }

  setBusy("simplification", true);
  renderLoading(simplifierOutputEl, "Simplifying language…");
  updateStatus("Simplifying with Chrome AI…");

  try {
    const tone = document.getElementById("simplifierTone")?.value || "more-casual";
    const length = document.getElementById("simplifierLength")?.value || "as-is";
    const result = await simplifyMedicalText(text, { tone, length });
    appState.simplifications.unshift(result);
    renderSimplification(simplifierOutputEl, result);
    updateStatus(
      result.source === "fallback"
        ? "Simplified excerpt ready (fallback)."
        : "Simplified excerpt ready."
    );
  } catch (error) {
    console.error("MedLit simplification error", error);
    renderError(simplifierOutputEl, error.message || "Unable to simplify text.");
    updateStatus("Simplification failed");
  } finally {
    setBusy("simplification", false);
  }
}

async function processTranslation(text, detectedLanguage) {
  if (isBusy("translation")) {
    return;
  }

  setBusy("translation", true);
  renderLoading(translationOutputEl, "Translating to English…");
  updateStatus("Translating selection via Chrome AI…");

  try {
    const result = await translateToEnglish(text, detectedLanguage);
    appState.translations.unshift(result);
    renderTranslation(translationOutputEl, result);
    updateStatus(
      result.source === "fallback"
        ? "Translation ready (fallback)."
        : "Translation ready."
    );
  } catch (error) {
    console.error("MedLit translation error", error);
    renderError(translationOutputEl, error.message || "Unable to translate selection.");
    updateStatus("Translation failed");
  } finally {
    setBusy("translation", false);
  }
}

async function getDocumentSnapshot(forceRefresh) {
  if (!forceRefresh && appState.lastDocument) {
    return appState.lastDocument;
  }

  const response = await sendRuntimeMessage(MESSAGE_TYPES.REQUEST_DOCUMENT);
  if (!response?.ok) {
    throw new Error(response?.error || "Unable to access current tab.");
  }
  appState.lastDocument = response.document;
  return response.document;
}

// Utility functions

function isBusy(key) {
  return busyFlags.has(key);
}

function setBusy(key, flag) {
  if (flag) {
    busyFlags.add(key);
  } else {
    busyFlags.delete(key);
  }
}

function updateStatus(message) {
  statusEl.textContent = message;
}

function summaryToMarkdown(data) {
  if (!data) {
    return "";
  }
  
  const formatSampleSize = (sample) => {
    if (!sample) return "Not specified";
    if (sample.total) {
      return `Total ${sample.total} (Intervention ${sample.intervention || "N/A"}, Control ${sample.control || "N/A"})`;
    }
    return `Intervention ${sample.intervention || "N/A"}, Control ${sample.control || "N/A"}`;
  };

  const lines = [
    "# Study Summary",
    data.studyType ? `- **Study Type:** ${data.studyType}` : null,
    data.framework ? `- **Framework:** ${data.framework}` : null,
    `- **Design:** ${data.studyDesign?.type || "Unknown"}`,
    `- **Setting:** ${data.studyDesign?.setting || "Unknown"}`,
    `- **Period:** ${data.studyDesign?.studyPeriod || "Unknown"}`,
    `- **Population:** ${formatSampleSize(data.population?.sampleSize)}`,
    `- **Intervention:** ${data.intervention?.description || "Not detailed"}`,
    `- **Comparator:** ${data.comparison?.description || "Not detailed"}`,
    `- **Primary Outcome:** ${data.outcomes?.primary?.measure || "Not specified"}`
  ].filter(Boolean);

  if (Array.isArray(data.outcomes?.secondary) && data.outcomes.secondary.length) {
    lines.push("## Secondary Outcomes");
    data.outcomes.secondary.forEach((outcome) => {
      lines.push(`- ${outcome?.measure || "Outcome"}: ${outcome?.result || "Result not provided"}`);
    });
  }

  lines.push("## Interpretation");
  lines.push(`- **Interpretation:** ${data.interpretation?.interpretation || "Not provided"}`);
  lines.push(`- **Applicability:** ${data.interpretation?.applicability || "Not provided"}`);
  lines.push(
    `- **Limitations:** ${
      Array.isArray(data.interpretation?.limitations) && data.interpretation.limitations.length
        ? data.interpretation.limitations.join("; ")
        : "Not listed"
    }`
  );

  return lines.join("\n");
}

// Chat functions

function enableChat(summary, documentSnapshot) {
  if (!summary?.data) {
    return;
  }
  
  // Store the context for chat
  appState.chatContext = {
    type: "summary",
    summary: summaryToMarkdown(summary.data),
    fullText: documentSnapshot?.article?.textContent || "",
    meta: documentSnapshot?.meta || {}
  };
  
  // Enable chat input
  chatInput.disabled = false;
  chatSendBtn.disabled = false;
  
  // Update empty state message
  if (appState.chatHistory.length === 0) {
    chatMessagesEl.classList.remove("empty-state");
    chatMessagesEl.innerHTML = '<p class="empty-text" style="text-align: center; padding: 1em 0;">Ask questions about the summarized content.</p>';
  }
}

function setChatContextFromSelection(text) {
  // Store the selected text as chat context
  appState.chatContext = {
    type: "selection",
    selectedText: text,
    meta: {}
  };
  
  // Clear previous chat history when switching context
  appState.chatHistory = [];
  
  // Enable chat input
  chatInput.disabled = false;
  chatSendBtn.disabled = false;
  
  // Determine context size and warning level
  const charCount = text.length;
  const recommendedMax = 2000; // ~500 tokens (conservative estimate: 4 chars per token)
  const warningThreshold = 4000; // ~1000 tokens
  
  let statusColor = "#3b82f6"; // Blue - good
  let statusIcon = "📝";
  let warningMessage = "";
  
  if (charCount > warningThreshold) {
    statusColor = "#ef4444"; // Red - too large
    statusIcon = "⚠️";
    warningMessage = `<br><span style="color: #ef4444; font-weight: 600;">⚠️ Context is very large (${charCount} chars). Consider selecting a smaller, more specific section for better accuracy.</span>`;
  } else if (charCount > recommendedMax) {
    statusColor = "#f59e0b"; // Orange - warning
    statusIcon = "⚠️";
    warningMessage = `<br><span style="color: #f59e0b;">Note: Large contexts may reduce answer accuracy. Recommended: <${recommendedMax} characters.</span>`;
  }
  
  // Update UI to show context is ready
  chatMessagesEl.classList.remove("empty-state");
  chatMessagesEl.innerHTML = `
    <div style="padding: 0.75em; margin-bottom: 0.5em; background: color-mix(in srgb, ${statusColor} 15%, transparent); border: 1px solid color-mix(in srgb, ${statusColor} 30%, transparent); border-radius: 8px; font-size: 13px;">
      <strong>${statusIcon} Chat context set</strong><br>
      <span style="color: color-mix(in srgb, CanvasText 70%, transparent);">Selected text loaded: <strong>${charCount.toLocaleString()} characters</strong> (~${Math.round(charCount / 4)} tokens)</span>
      ${warningMessage}
    </div>
  `;
  
  updateStatus(`Chat context loaded (${charCount} chars).`);
  
  // Focus the input
  chatInput.focus();
}

async function handleChatSubmit() {
  const question = chatInput.value.trim();
  if (!question || !appState.chatContext) {
    return;
  }
  
  if (isBusy("chat")) {
    return;
  }
  
  setBusy("chat", true);
  
  // Clear input immediately
  chatInput.value = "";
  
  // Add user message to chat
  addChatMessage("user", question);
  
  // Show loading indicator
  const loadingId = addChatMessage("assistant", "Thinking...", true);
  
  updateStatus("Processing question with Chrome AI…");
  
  try {
    const answer = await askQuestion(question, appState.chatContext, appState.chatHistory);
    
    // Remove loading message
    const loadingEl = document.querySelector(`[data-message-id="${loadingId}"]`);
    if (loadingEl) {
      loadingEl.remove();
    }
    
    // Add assistant response
    addChatMessage("assistant", answer);
    
    // Store in history
    appState.chatHistory.push(
      { role: "user", content: question },
      { role: "assistant", content: answer }
    );
    
    updateStatus("Answer ready.");
  } catch (error) {
    console.error("MedLit chat error", error);
    
    // Remove loading message
    const loadingEl = document.querySelector(`[data-message-id="${loadingId}"]`);
    if (loadingEl) {
      loadingEl.remove();
    }
    
    addChatMessage("assistant", `Error: ${error.message || "Unable to process question."}`, false, true);
    updateStatus("Question failed");
  } finally {
    setBusy("chat", false);
  }
}

function handleClearChat() {
  appState.chatHistory = [];
  appState.chatContext = null;
  chatInput.disabled = true;
  chatSendBtn.disabled = true;
  chatMessagesEl.classList.add("empty-state");
  chatMessagesEl.innerHTML = `
    <p><strong>Option 1:</strong> Generate a summary first, then ask questions about the study.</p>
    <p><strong>Option 2:</strong> Highlight text, right-click → "Chat with selection" to ask about specific content.</p>
  `;
  updateStatus("Chat cleared.");
}

function handleClearSummary() {
  appState.summary = null;
  appState.lastDocument = null;
  picoOutputEl.classList.add("empty-state");
  picoOutputEl.innerHTML = `
    <p><strong>Option 1:</strong> Click "Generate Study Summary" above to analyze the full page.</p>
    <p><strong>Option 2 (Recommended for PDFs):</strong> Highlight text, right-click → "Summarize from selection".</p>
  `;
  updateStatus("Summary cleared.");
}

function handleClearMethodology() {
  appState.methodology = null;
  methodologyOutputEl.classList.add("empty-state");
  methodologyOutputEl.innerHTML = `<p>Highlight a methods section in the paper, right-click → "Assess methodology from selection".</p>`;
  updateStatus("Methodology assessment cleared.");
}

function handleClearSimplifier() {
  appState.simplifications = [];
  simplifierOutputEl.classList.add("empty-state");
  simplifierOutputEl.innerHTML = `<p>Highlight complex medical or technical text, then select "Simplify language from selection" from the context menu.</p>`;
  updateStatus("Simplifications cleared.");
}

function handleClearTranslation() {
  appState.translations = [];
  translationOutputEl.classList.add("empty-state");
  translationOutputEl.innerHTML = `<p>Translate non-English text to English using the "Translate selection to English" context menu option.</p>`;
  updateStatus("Translations cleared.");
}

// Export modal functions

function openExportModal() {
  exportModal.style.display = "flex";
}

function closeExportModal() {
  exportModal.style.display = "none";
}

async function handleExportFormat(format) {
  const selectedSections = [];
  
  sectionCheckboxes.forEach(cb => {
    if (cb.checked) {
      selectedSections.push(cb.value);
    }
  });
  
  if (selectedSections.length === 0) {
    updateStatus("Please select at least one section to export.");
    return;
  }
  
  try {
    updateStatus("Preparing export...");
    
    if (format === "json") {
      await exportAsJson(selectedSections);
    } else if (format === "md") {
      await exportAsMarkdown(selectedSections);
    }
    
    updateStatus(`Exported ${selectedSections.length} section(s) as ${format.toUpperCase()}.`);
    closeExportModal();
  } catch (error) {
    console.error("Export error:", error);
    updateStatus("Export failed: " + error.message);
  }
}

async function exportAsJson(sections) {
  const exportData = {
    exportedAt: new Date().toISOString(),
    format: "json",
    sections: {}
  };
  
  for (const section of sections) {
    switch (section) {
      case "summary":
        if (appState.summary?.data) {
          exportData.sections.summary = {
            ...appState.summary.data,
            meta: appState.lastDocument?.meta || {}
          };
        }
        break;
      case "methodology":
        if (appState.methodology?.data) {
          exportData.sections.methodology = appState.methodology.data;
        }
        break;
      case "simplification":
        if (appState.simplifications.length > 0) {
          exportData.sections.simplifications = appState.simplifications.map(s => s.data);
        }
        break;
      case "translation":
        if (appState.translations.length > 0) {
          exportData.sections.translations = appState.translations.map(t => t.data);
        }
        break;
      case "chat":
        if (appState.chatHistory.length > 0) {
          exportData.sections.chatHistory = appState.chatHistory;
        }
        break;
    }
  }
  
  const blob = new Blob([JSON.stringify(exportData, null, 2)], {
    type: "application/json"
  });
  downloadFile(blob, `medlit-export-${Date.now()}.json`);
}

async function exportAsMarkdown(sections) {
  let markdown = `# MedLit Export\n\n`;
  markdown += `**Exported:** ${new Date().toLocaleString()}\n\n`;
  markdown += `---\n\n`;
  
  for (const section of sections) {
    switch (section) {
      case "summary":
        if (appState.summary?.data) {
          markdown += `## Study Summary\n\n`;
          markdown += summaryToMarkdown(appState.summary.data);
          markdown += `\n\n---\n\n`;
        }
        break;
      case "methodology":
        if (appState.methodology?.data) {
          markdown += `## Methodology Assessment\n\n`;
          markdown += methodologyToMarkdown(appState.methodology.data);
          markdown += `\n\n---\n\n`;
        }
        break;
      case "simplification":
        if (appState.simplifications.length > 0) {
          markdown += `## Language Simplifications\n\n`;
          appState.simplifications.forEach((s, i) => {
            markdown += `### Simplification ${i + 1}\n\n`;
            markdown += `**Original Tone:** ${s.data.tone || 'N/A'}\n`;
            markdown += `**Original Length:** ${s.data.length || 'N/A'}\n\n`;
            markdown += `${s.data.plainEnglish || ''}\n\n`;
            if (s.data.keyTerms?.length) {
              markdown += `**Key Terms:**\n`;
              s.data.keyTerms.forEach(({term, definition}) => {
                markdown += `- **${term}:** ${definition}\n`;
              });
              markdown += `\n`;
            }
          });
          markdown += `---\n\n`;
        }
        break;
      case "translation":
        if (appState.translations.length > 0) {
          markdown += `## Translations\n\n`;
          appState.translations.forEach((t, i) => {
            markdown += `### Translation ${i + 1}\n\n`;
            markdown += `**Language:** ${t.data.detectedLanguage || 'Unknown'}\n\n`;
            markdown += `${t.data.translatedText || ''}\n\n`;
          });
          markdown += `---\n\n`;
        }
        break;
      case "chat":
        if (appState.chatHistory.length > 0) {
          markdown += `## Chat History\n\n`;
          appState.chatHistory.forEach((msg) => {
            const role = msg.role === "user" ? "**You**" : "**Assistant**";
            markdown += `${role}: ${msg.content}\n\n`;
          });
          markdown += `---\n\n`;
        }
        break;
    }
  }
  
  const blob = new Blob([markdown], { type: "text/markdown" });
  downloadFile(blob, `medlit-export-${Date.now()}.md`);
}

function methodologyToMarkdown(data) {
  let md = `**Overall Quality Score:** ${data.overallQualityScore || 0}/100\n\n`;
  
  if (data.researchQuestionClarity) {
    md += `### Research Question Clarity\n`;
    md += `- **Score:** ${data.researchQuestionClarity.score || 0}/5\n`;
    if (data.researchQuestionClarity.strengths?.length) {
      md += `- **Strengths:** ${data.researchQuestionClarity.strengths.join(", ")}\n`;
    }
    if (data.researchQuestionClarity.concerns?.length) {
      md += `- **Concerns:** ${data.researchQuestionClarity.concerns.join(", ")}\n`;
    }
    md += `\n`;
  }
  
  if (data.sampleSizePower) {
    md += `### Sample Size & Power\n`;
    md += `- **Score:** ${data.sampleSizePower.score || 0}/5\n`;
    if (data.sampleSizePower.calculated) {
      md += `- **Calculated Size:** ${data.sampleSizePower.calculated}\n`;
    }
    if (data.sampleSizePower.actual) {
      md += `- **Actual Size:** ${data.sampleSizePower.actual}\n`;
    }
    md += `\n`;
  }
  
  if (data.keyLimitations?.length) {
    md += `### Key Limitations\n`;
    data.keyLimitations.forEach(lim => {
      md += `- ${lim}\n`;
    });
    md += `\n`;
  }
  
  if (data.recommendation) {
    md += `**Recommendation:** ${data.recommendation}\n`;
  }
  
  return md;
}

function downloadFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function addChatMessage(role, content, isLoading = false, isError = false) {
  const messageId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const messageEl = document.createElement("div");
  messageEl.className = `chat-message chat-message-${role}`;
  messageEl.setAttribute("data-message-id", messageId);
  
  if (isError) {
    messageEl.classList.add("chat-message-error");
  }
  
  if (isLoading) {
    messageEl.classList.add("chat-message-loading");
  }
  
  const label = document.createElement("div");
  label.className = "chat-message-label";
  label.textContent = role === "user" ? "You" : "Assistant";
  
  const text = document.createElement("div");
  text.className = "chat-message-text";
  
  // Render markdown for assistant messages, plain text for user messages
  if (role === "assistant" && !isLoading) {
    text.innerHTML = marked.parse(content);
  } else {
    text.textContent = content;
  }
  
  messageEl.appendChild(label);
  messageEl.appendChild(text);
  
  // Remove empty state if present
  const emptyText = chatMessagesEl.querySelector(".empty-text");
  if (emptyText) {
    emptyText.remove();
  }
  
  chatMessagesEl.appendChild(messageEl);
  
  // Scroll to bottom
  messageEl.scrollIntoView({ behavior: "smooth", block: "end" });
  
  return messageId;
}

async function askQuestion(question, context, history) {
  // Build context prompt based on context type
  let contextPrompt;
  
  if (context.type === "selection") {
    // User selected specific text to chat about
    // Use full text up to 2000 chars (recommended), warn user if larger
    const truncatedText = context.selectedText?.substring(0, 2000) || "";
    const hasMoreText = context.selectedText?.length > 2000;
    
    contextPrompt = `You are a helpful medical research assistant. Answer questions about the following selected text from a research paper.

=== SELECTED TEXT ===
${truncatedText}
${hasMoreText ? '\n[...text truncated for token limits - only first 2000 characters used...]' : ''}

Provide clear, accurate answers based on the selected text above. Reference specific details and quote relevant passages when helpful. If the answer is not in the provided text, say so clearly.`;
  } else {
    // Default: use summary and full text
    const truncatedFullText = context.fullText?.substring(0, 1500) || "";
    const hasMoreText = context.fullText?.length > 1500;
    
    contextPrompt = `You are a helpful medical research assistant. Answer questions about the following research paper.

=== STRUCTURED SUMMARY ===
${context.summary}

=== FULL PAPER TEXT (${hasMoreText ? 'excerpt' : 'complete'}) ===
${truncatedFullText}
${hasMoreText ? '\n[...text truncated for token limits...]' : ''}

Provide clear, accurate answers based on the content above. Reference specific details from the full text when available. If the information is not in the provided content, say so clearly.`;
  }
  
  // Create AI session using the same method as other features
  const session = await createAISession({
    systemPrompt: contextPrompt,
    temperature: 0.4,
    topK: 12
  });
  
  if (!session) {
    throw new Error("Chrome AI Prompt API is not available. Please enable it in chrome://flags.");
  }
  
  try {
    // Build conversation context
    let prompt = "";
    
    // Add recent history (last 3 exchanges to avoid token limits)
    const recentHistory = history.slice(-6); // Last 3 Q&A pairs
    if (recentHistory.length > 0) {
      prompt += "Previous conversation:\n";
      for (const msg of recentHistory) {
        prompt += `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}\n`;
      }
      prompt += "\n";
    }
    
    prompt += `User: ${question}\nAssistant:`;
    
    const response = await session.prompt(prompt);
    
    // Log token usage for debugging (optional)
    if (session.inputUsage !== undefined && session.inputQuota !== undefined) {
      console.log(`MedLit Chat: ${session.inputUsage}/${session.inputQuota} tokens used (${Math.round(session.inputUsage / session.inputQuota * 100)}%)`);
    }
    
    return response.trim();
  } catch (error) {
    console.error("Error asking question:", error);
    throw new Error(error.message || "Failed to get answer from AI.");
  } finally {
    // Clean up session
    if (session && typeof session.destroy === "function") {
      session.destroy();
    }
  }
}

// Settings modal functions

function openSettingsModal() {
  loadSettings();
  settingsModal.style.display = "flex";
}

function closeSettingsModal() {
  settingsModal.style.display = "none";
}

async function loadSettings() {
  try {
    const result = await chrome.storage.local.get(["theme", "font", "dyslexicLetterSpacing", "dyslexicFontSize"]);
    const theme = result.theme || "light";
    const font = result.font || "sans-serif";
    const letterSpacing = result.dyslexicLetterSpacing || 0.02;
    const fontSize = result.dyslexicFontSize || 14;
    
    // Set radio button states
    const themeRadio = document.querySelector(`input[name="theme"][value="${theme}"]`);
    const fontRadio = document.querySelector(`input[name="font"][value="${font}"]`);
    
    if (themeRadio) themeRadio.checked = true;
    if (fontRadio) fontRadio.checked = true;
    
    // Show dyslexic options if dyslexic font is selected
    if (font === "dyslexic") {
      dyslexicOptions.style.display = "flex";
    }
    
    // Set slider values
    letterSpacingSlider.value = letterSpacing;
    letterSpacingValue.textContent = `${letterSpacing.toFixed(2)}em`;
    fontSizeSlider.value = fontSize;
    fontSizeValue.textContent = `${fontSize}px`;
  } catch (error) {
    console.error("Error loading settings:", error);
  }
}

async function saveSettings() {
  try {
    const selectedTheme = document.querySelector('input[name="theme"]:checked')?.value || "light";
    const selectedFont = document.querySelector('input[name="font"]:checked')?.value || "sans-serif";
    const letterSpacing = parseFloat(letterSpacingSlider.value);
    const fontSize = parseInt(fontSizeSlider.value);
    
    await chrome.storage.local.set({
      theme: selectedTheme,
      font: selectedFont,
      dyslexicLetterSpacing: letterSpacing,
      dyslexicFontSize: fontSize
    });
    
    applySettings(selectedTheme, selectedFont, letterSpacing, fontSize);
    updateStatus("Settings saved.");
    closeSettingsModal();
  } catch (error) {
    console.error("Error saving settings:", error);
    updateStatus("Failed to save settings.");
  }
}

function applySettings(theme, font, letterSpacing = 0.02, fontSize = 14) {
  // Apply theme
  document.body.setAttribute("data-theme", theme);
  
  // Apply font
  document.body.setAttribute("data-font", font);
  
  // Apply dyslexic font customization
  if (font === "dyslexic") {
    document.documentElement.style.setProperty("--dyslexic-letter-spacing", `${letterSpacing}em`);
    document.documentElement.style.setProperty("--dyslexic-font-size", `${fontSize}px`);
  }
}

// Load settings on page load
(async function initSettings() {
  try {
    const result = await chrome.storage.local.get(["theme", "font", "dyslexicLetterSpacing", "dyslexicFontSize"]);
    const theme = result.theme || "light";
    const font = result.font || "sans-serif";
    const letterSpacing = result.dyslexicLetterSpacing || 0.02;
    const fontSize = result.dyslexicFontSize || 14;
    applySettings(theme, font, letterSpacing, fontSize);
  } catch (error) {
    console.error("Error initializing settings:", error);
  }
})();
