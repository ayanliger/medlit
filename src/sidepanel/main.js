import {
  buildKeyPointsExport,
  evaluateMethodology,
  generateStructuredSummary,
  simplifyMedicalText,
  translateToEnglish
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

const appState = {
  lastDocument: null,
  summary: null,
  methodology: null,
  simplifications: [],
  translations: []
};

const busyFlags = new Set();

document.getElementById("generateSummaryBtn").addEventListener("click", () => {
  void handleGenerateSummary({ forceRefresh: false });
});

document.getElementById("refreshSummaryBtn").addEventListener("click", () => {
  void handleGenerateSummary({ forceRefresh: true });
});

document.getElementById("methodologyBtn").addEventListener("click", () => {
  void handleMethodologyFromButton();
});

document.getElementById("settingsBtn").addEventListener("click", () => {
  updateStatus("Settings coming soon.");
  renderInfo(
    methodologyOutputEl,
    "Settings will let you adjust prompt temperature, export defaults, and privacy controls.",
    "info"
  );
});

exportBtn.addEventListener("click", () => {
  void handleExport();
});

chrome.runtime.onMessage.addListener((message) => {
  if (!message?.type?.startsWith("medlit:") || message?.source !== MESSAGE_SOURCE.SERVICE_WORKER) {
    return;
  }

  switch (message.type) {
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
    default:
      break;
  }
});

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
    renderStructuredSummary(picoOutputEl, summary);
    exportBtn.disabled = false;
    updateStatus(summary.source === "fallback" ? "Summary ready (fallback mode)." : "Summary ready.");
  } catch (error) {
    console.error("MedLit summary error", error);
    renderError(picoOutputEl, error.message || "Unable to produce summary.");
    updateStatus("Summary failed");
  } finally {
    setBusy("summary", false);
  }
}

async function handleMethodologyFromButton() {
  if (isBusy("methodology")) {
    return;
  }

  setBusy("methodology", true);
  renderLoading(methodologyOutputEl, "Waiting for highlighted methods section…");
  updateStatus("Capture a methods section then run Scan Methodology.");

  try {
    const selectionResponse = await sendRuntimeMessage(MESSAGE_TYPES.REQUEST_LAST_SELECTION);
    const text = selectionResponse?.selection?.text?.trim();
    if (!text) {
      renderInfo(
        methodologyOutputEl,
        "Highlight a methods section in the paper, then choose the context menu item or press this button again.",
        "info"
      );
      updateStatus("Select a methods section to analyze.");
      return;
    }

    await processMethodology(text);
  } catch (error) {
    console.error("MedLit methodology button error", error);
    renderError(methodologyOutputEl, error.message || "Unable to scan methodology.");
    updateStatus("Methodology scan failed");
  } finally {
    setBusy("methodology", false);
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
  updateStatus("Generating plain-language explanation…");

  try {
    const result = await simplifyMedicalText(text);
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

async function handleExport() {
  if (!appState.summary?.data) {
    updateStatus("Generate a summary first to enable exports.");
    renderInfo(picoOutputEl, "Run a summary before exporting key points.", "info");
    return;
  }

  if (isBusy("export")) {
    return;
  }

  setBusy("export", true);
  updateStatus("Preparing export preview…");

  try {
    const documentSnapshot = await getDocumentSnapshot(false);
    const summaryMarkdown = summaryToMarkdown(appState.summary.data);
    const exportPayload = await buildKeyPointsExport(
      summaryMarkdown,
      documentSnapshot?.article?.textContent ?? ""
    );

    const exportData = {
      generatedAt: exportPayload.generatedAt,
      source: exportPayload.source,
      keyPoints: exportPayload.data,
      summaryMarkdown,
      meta: documentSnapshot?.meta ?? {}
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const filename = createExportFilename(documentSnapshot?.meta?.title);

    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);

    updateStatus("Export downloaded.");
  } catch (error) {
    console.error("MedLit export error", error);
    renderError(picoOutputEl, error.message || "Unable to build export.");
    updateStatus("Export failed");
  } finally {
    setBusy("export", false);
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
    `- **Design:** ${data.studyDesign?.type || "Unknown"}`,
    `- **Setting:** ${data.studyDesign?.setting || "Unknown"}`,
    `- **Period:** ${data.studyDesign?.studyPeriod || "Unknown"}`,
    `- **Population:** ${formatSampleSize(data.population?.sampleSize)}`,
    `- **Intervention:** ${data.intervention?.description || "Not detailed"}`,
    `- **Comparator:** ${data.comparison?.description || "Not detailed"}`,
    `- **Primary Outcome:** ${data.outcomes?.primary?.measure || "Not specified"}`
  ];

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

function createExportFilename(title = "") {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "medlit-paper";
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${slug}-${timestamp}.json`;
}
