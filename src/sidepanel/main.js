import {
  buildKeyPointsExport,
  evaluateMethodology,
  generateStructuredSummary,
  simplifyMedicalText,
  translateToEnglish
} from "../ai/aiClient.js";

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
  if (!message?.type?.startsWith("medlit:") || message?.source !== "medlit-service-worker") {
    return;
  }

  switch (message.type) {
    case "medlit:context-methodology": {
      const text = message.payload?.text;
      if (!text) {
        renderError(methodologyOutputEl, "No text supplied from context menu.");
        return;
      }
      void processMethodology(text);
      break;
    }
    case "medlit:context-simplify": {
      const text = message.payload?.text;
      if (!text) {
        renderError(simplifierOutputEl, "No text supplied for simplification.");
        return;
      }
      void processSimplification(text);
      break;
    }
    case "medlit:context-translate": {
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
    renderStructuredSummary(summary);
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
    const selectionResponse = await sendRuntimeMessage("medlit:request-last-selection");
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
    renderMethodology(result);
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
    renderSimplification(result);
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
    renderTranslation(result);
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

  const response = await sendRuntimeMessage("medlit:request-document");
  if (!response?.ok) {
    throw new Error(response?.error || "Unable to access current tab.");
  }
  appState.lastDocument = response.document;
  return response.document;
}

async function sendRuntimeMessage(type, payload) {
  try {
    return await chrome.runtime.sendMessage({ type, payload });
  } catch (error) {
    throw new Error(error?.message || "Extension messaging failed.");
  }
}

function renderStructuredSummary(result) {
  if (!result?.data) {
    renderError(picoOutputEl, "No summary data returned.");
    return;
  }

  const sections = [
    {
      title: "Study Design",
      entries: [
        ["Type", result.data.studyDesign?.type],
        ["Setting", result.data.studyDesign?.setting],
        ["Period", result.data.studyDesign?.studyPeriod],
        ["Registration", result.data.studyDesign?.registrationID || "Not listed"]
      ]
    },
    {
      title: "Population",
      entries: [
        [
          "Sample Size",
          formatSampleSize(result.data.population?.sampleSize)
        ],
        ["Demographics", summarizeDemographics(result.data.population?.demographics)],
        [
          "Inclusion Criteria",
          arrayDefinitionValue(result.data.population?.inclusionCriteria, "Not specified", {
            bullet: true
          })
        ],
        [
          "Exclusion Criteria",
          arrayDefinitionValue(result.data.population?.exclusionCriteria, "Not specified", {
            bullet: true
          })
        ]
      ]
    },
    {
      title: "Intervention & Comparison",
      entries: [
        ["Intervention", result.data.intervention?.description],
        ["Dosage / Protocol", result.data.intervention?.dosage],
        ["Duration", result.data.intervention?.duration],
        ["Comparator", result.data.comparison?.description],
        ["Comparator Type", result.data.comparison?.controlType]
      ]
    },
    {
      title: "Primary Outcome",
      entries: [
        ["Measure", result.data.outcomes?.primary?.measure],
        ["Intervention Result", result.data.outcomes?.primary?.interventionResult],
        ["Control Result", result.data.outcomes?.primary?.controlResult],
        ["p-Value", normalizeStatistic(result.data.outcomes?.primary?.pValue)],
        ["Confidence Interval", result.data.outcomes?.primary?.confidenceInterval],
        ["Effect Size", result.data.outcomes?.primary?.effectSize]
      ]
    },
    {
      title: "Secondary Outcomes",
      customBody: renderSecondaryOutcomes(result.data.outcomes?.secondary)
    },
    {
      title: "Interpretation",
      entries: [
        ["NNT", result.data.interpretation?.NNT ?? "Not reported"],
        ["Interpretation", result.data.interpretation?.interpretation],
        [
          "Limitations",
          arrayDefinitionValue(result.data.interpretation?.limitations, "Not listed", { bullet: true })
        ],
        ["Applicability", result.data.interpretation?.applicability]
      ]
    }
  ];

  const html = [
    renderResultMeta(result),
    ...sections.map((section) => renderSectionCard(section))
  ].join("");

  picoOutputEl.classList.remove("empty-state");
  picoOutputEl.innerHTML = html;
}

function renderMethodology(result) {
  if (!result?.data) {
    renderError(methodologyOutputEl, "No methodology data returned.");
    return;
  }

  const cards = [
    renderScoreCard("Research Question Clarity", result.data.researchQuestionClarity),
    renderScoreCard("Sample Size & Power", result.data.sampleSizePower),
    renderScoreCard("Randomization", result.data.randomization),
    renderScoreCard("Blinding", result.data.blinding, { treatBooleansAsBadges: true }),
    renderScoreCard("Statistical Approach", result.data.statisticalApproach)
  ];

  const html = [
    renderResultMeta(result),
    `<div class="result-card">
      <h3>Overall Quality</h3>
      ${renderScoreMeter(result.data.overallQualityScore, 100)}
    </div>`,
    ...cards,
    `<div class="result-card">
      <h3>Key Limitations</h3>
      ${renderBulletList(result.data.keyLimitations, "No limitations captured.")}
      <p><strong>Recommendation:</strong> ${escapeHtml(result.data.recommendation || "Not provided.")}</p>
    </div>`
  ].join("");

  methodologyOutputEl.classList.remove("empty-state");
  methodologyOutputEl.innerHTML = html;
}

function renderSimplification(result) {
  if (!result?.data) {
    renderError(simplifierOutputEl, "No simplification data returned.");
    return;
  }

  const html = [
    renderResultMeta(result),
    `<div class="result-card">
      <h3>Plain English</h3>
      <p>${escapeHtml(result.data.plainEnglish || "")}</p>
    </div>`,
    result.data.keyTerms?.length
      ? `<div class="result-card">
          <h3>Key Terms</h3>
          ${renderDefinitionList(result.data.keyTerms.map(({ term, definition }) => [term, definition]))}
        </div>`
      : "",
    result.data.statisticsNotes?.length
      ? `<div class="result-card">
          <h3>Statistics Notes</h3>
          ${renderBulletList(result.data.statisticsNotes, "No statistical notes captured.")}
        </div>`
      : ""
  ].join("");

  simplifierOutputEl.classList.remove("empty-state");
  simplifierOutputEl.innerHTML = html;
}

function renderTranslation(result) {
  if (!result?.data) {
    renderError(translationOutputEl, "No translation data returned.");
    return;
  }

  const html = [
    renderResultMeta(result),
    `<div class="result-card">
      <h3>Translated Text</h3>
      <p>${escapeHtml(result.data.translatedText || "")}</p>
    </div>`,
    `<div class="result-card">
      <h3>Details</h3>
      ${renderDefinitionList([
        ["Detected Language", result.data.detectedLanguage || "Unknown"],
        ["Source", formatSourceName(result.source)]
      ])}
    </div>`,
    result.data.notes?.length
      ? `<div class="result-card">
          <h3>Notes</h3>
          ${renderBulletList(result.data.notes, "No additional notes.")}
        </div>`
      : ""
  ].join("");

  translationOutputEl.classList.remove("empty-state");
  translationOutputEl.innerHTML = html;
}

function renderResultMeta(result) {
  const parts = [];
  parts.push(renderBadge(formatSourceName(result.source)));
  if (result.message) {
    parts.push(renderInfoBanner(result.message, "info"));
  }
  if (result.warning) {
    parts.push(renderInfoBanner(result.warning, "warning"));
  }
  return parts.join("");
}

function renderSectionCard(section) {
  const content = section.customBody || renderDefinitionList(section.entries);
  return `<div class="result-card">
    <h3>${escapeHtml(section.title)}</h3>
    ${content}
  </div>`;
}

function renderScoreCard(title, block, options = {}) {
  if (!block) {
    return `<div class="result-card"><h3>${escapeHtml(title)}</h3>${renderInfoBanner(
      "No data returned for this category.",
      "info"
    )}</div>`;
  }

  const entries = [];

  if (block.score !== undefined) {
    entries.push([
      "Score",
      `<span class="score">${escapeHtml(String(block.score))}/5 ${renderScoreMeter(
        block.score,
        5,
        true
      )}</span>`
    ]);
  }

  if (options.treatBooleansAsBadges) {
    for (const [key, value] of Object.entries(block)) {
      if (typeof value === "boolean") {
        entries.push([
          capitalize(key),
          renderBadge(value ? "Yes" : "No", value ? "info" : "warning")
        ]);
      }
    }
  }

  if (block.method) {
    entries.push(["Method", block.method]);
  }

  if (block.methods?.length) {
    entries.push(["Methods", arrayDefinitionValue(block.methods, "Not specified")]);
  }

  if (block.calculated !== undefined || block.actual !== undefined) {
    entries.push([
      "Sample Size",
      `Calculated: ${escapeHtml(formatNumber(block.calculated))}, Actual: ${escapeHtml(
        formatNumber(block.actual)
      )}`
    ]);
  }

  const content = [
    renderDefinitionList(entries),
    block.strengths?.length
      ? `<div>
           <strong>Strengths</strong>
           ${renderBulletList(block.strengths, "No strengths provided.")}
         </div>`
      : "",
    block.concerns?.length
      ? `<div>
           <strong>Concerns</strong>
           ${renderBulletList(block.concerns, "No concerns raised.")}
         </div>`
      : ""
  ].join("");

  return `<div class="result-card">
    <h3>${escapeHtml(title)}</h3>
    ${content}
  </div>`;
}

function renderSecondaryOutcomes(outcomes) {
  if (!outcomes?.length) {
    return renderInfoBanner("No secondary outcomes provided.", "info");
  }

  const items = outcomes
    .filter(Boolean)
    .map(
      (outcome) =>
        `<li><strong>${escapeHtml(outcome.measure || "Outcome")}:</strong> ${sanitizeHtml(
          outcome.result || "Result not specified"
        )}</li>`
    );

  return `<ul>${items.join("")}</ul>`;
}

function renderDefinitionList(entries = []) {
  const normalized = entries.filter((entry) => entry && entry.length === 2);

  if (!normalized.length) {
    return `<p class="empty-text">No data available.</p>`;
  }

  const html = normalized
    .map(
      ([key, value]) =>
        `<dt>${escapeHtml(String(key))}</dt><dd>${renderDefinitionValue(value)}</dd>`
    )
    .join("");

  return `<dl class="dl">${html}</dl>`;
}

function renderDefinitionValue(value) {
  if (value && typeof value === "object" && "__html" in value) {
    return value.__html;
  }
  if (
    value === undefined ||
    value === null ||
    (typeof value === "string" && value.trim().length === 0)
  ) {
    return `<span class="empty-text">—</span>`;
  }
  return sanitizeHtml(String(value));
}

function renderBulletList(items = [], emptyMessage = "No items.") {
  const normalized = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!normalized.length) {
    return `<p class="empty-text">${escapeHtml(emptyMessage)}</p>`;
  }

  return `<ul>${normalized.map((item) => `<li>${sanitizeHtml(String(item))}</li>`).join("")}</ul>`;
}

function arrayDefinitionValue(items, fallback, options = {}) {
  if (!Array.isArray(items) || items.length === 0) {
    return fallback;
  }

  if (options.bullet) {
    return { __html: renderBulletList(items) };
  }

  return items.join("; ");
}

function renderInfo(target, message, tone = "info") {
  target.classList.remove("empty-state");
  target.innerHTML = renderInfoBanner(message, tone);
}

function renderInfoBanner(message, tone = "info") {
  const className = ["info-banner", tone === "warning" ? "warning" : tone === "error" ? "error" : ""]
    .filter(Boolean)
    .join(" ");
  return `<div class="${className}">${escapeHtml(message)}</div>`;
}

function renderLoading(target, message) {
  target.classList.remove("empty-state");
  target.innerHTML = `<div class="result-card">${escapeHtml(message)}</div>`;
}

function renderError(target, message) {
  target.classList.remove("empty-state");
  target.innerHTML = renderInfoBanner(message, "error");
}

function renderBadge(label, tone = "info") {
  const toneClass =
    tone === "warning" ? "warning" : tone === "error" ? "error" : tone === "success" ? "success" : "";
  const classes = ["badge", toneClass].filter(Boolean).join(" ");
  return `<span class="${classes}">${escapeHtml(label)}</span>`;
}

function renderScoreMeter(value, max, compact = false) {
  const parsedValue = typeof value === "number" ? value : parseFloat(value);
  if (Number.isNaN(parsedValue)) {
    return `<span class="badge warning">N/A</span>`;
  }
  const ratio = Math.max(0, Math.min(parsedValue / max, 1));
  const display = compact ? "" : `<span>${escapeHtml(String(value))}/${escapeHtml(String(max))}</span>`;
  return `<span class="score-meter">${display}<span class="score-meter-fill" style="transform: scaleX(${ratio});"></span></span>`;
}

function formatSampleSize(sample) {
  if (!sample) {
    return "Not specified";
  }
  if (sample.total) {
    return `Total ${formatNumber(sample.total)} (Intervention ${formatNumber(
      sample.intervention
    )}, Control ${formatNumber(sample.control)})`;
  }
  return `Intervention ${formatNumber(sample.intervention)}, Control ${formatNumber(sample.control)}`;
}

function summarizeDemographics(demo) {
  if (!demo) {
    return "Not specified";
  }

  const parts = [];
  if (demo.age) parts.push(`Age: ${demo.age}`);
  if (demo.gender) parts.push(`Gender: ${demo.gender}`);
  if (demo.ethnicity) parts.push(`Ethnicity: ${demo.ethnicity}`);
  return parts.length ? parts.join(" • ") : "Not specified";
}

function normalizeStatistic(value) {
  if (value === null || value === undefined || value === "") {
    return "Not reported";
  }
  const num = Number(value);
  if (Number.isNaN(num)) {
    return value;
  }
  return num.toPrecision(3);
}

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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function sanitizeHtml(value) {
  return escapeHtml(value).replaceAll("\n", "<br />");
}

function formatNumber(value) {
  if (value === null || value === undefined || value === "") {
    return "N/A";
  }
  const num = Number(value);
  if (Number.isNaN(num)) {
    return String(value);
  }
  return num.toLocaleString();
}

function capitalize(text) {
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1).replace(/([A-Z])/g, " $1");
}

function formatSourceName(source) {
  switch (source) {
    case "chrome-ai-language-model":
      return "Chrome AI (Gemini Nano)";
    case "chrome-ai-rewriter":
      return "Chrome AI Rewriter";
    case "chrome-ai-translation":
      return "Chrome AI Translator";
    case "fallback":
      return "Heuristic Preview";
    default:
      return "Unknown Source";
  }
}

function summaryToMarkdown(data) {
  if (!data) {
    return "";
  }
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
