/**
 * Rendering utilities for the MedLit side panel
 */

/**
 * Renders a structured summary result
 * @param {HTMLElement} target - The target element to render into
 * @param {Object} result - The summary result object
 */
export function renderStructuredSummary(target, result) {
  if (!result?.data) {
    renderError(target, "No summary data returned.");
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

  target.classList.remove("empty-state");
  target.innerHTML = html;
}

/**
 * Renders a methodology assessment result
 * @param {HTMLElement} target - The target element to render into
 * @param {Object} result - The methodology result object
 */
export function renderMethodology(target, result) {
  if (!result?.data) {
    renderError(target, "No methodology data returned.");
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

  target.classList.remove("empty-state");
  target.innerHTML = html;
}

/**
 * Renders a simplification result
 * @param {HTMLElement} target - The target element to render into
 * @param {Object} result - The simplification result object
 */
export function renderSimplification(target, result) {
  if (!result?.data) {
    renderError(target, "No simplification data returned.");
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

  target.classList.remove("empty-state");
  target.innerHTML = html;
}

/**
 * Renders a translation result
 * @param {HTMLElement} target - The target element to render into
 * @param {Object} result - The translation result object
 */
export function renderTranslation(target, result) {
  if (!result?.data) {
    renderError(target, "No translation data returned.");
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

  target.classList.remove("empty-state");
  target.innerHTML = html;
}

/**
 * Renders an informational message
 * @param {HTMLElement} target - The target element
 * @param {string} message - The message to display
 * @param {string} tone - The tone ('info', 'warning', 'error')
 */
export function renderInfo(target, message, tone = "info") {
  target.classList.remove("empty-state");
  target.innerHTML = renderInfoBanner(message, tone);
}

/**
 * Renders a loading message
 * @param {HTMLElement} target - The target element
 * @param {string} message - The loading message
 */
export function renderLoading(target, message) {
  target.classList.remove("empty-state");
  target.innerHTML = `<div class="result-card">${escapeHtml(message)}</div>`;
}

/**
 * Renders an error message
 * @param {HTMLElement} target - The target element
 * @param {string} message - The error message
 */
export function renderError(target, message) {
  target.classList.remove("empty-state");
  target.innerHTML = renderInfoBanner(message, "error");
}

// Helper rendering functions

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

function renderInfoBanner(message, tone = "info") {
  const className = ["info-banner", tone === "warning" ? "warning" : tone === "error" ? "error" : ""]
    .filter(Boolean)
    .join(" ");
  return `<div class="${className}">${escapeHtml(message)}</div>`;
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

// Formatting utilities

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

function arrayDefinitionValue(items, fallback, options = {}) {
  if (!Array.isArray(items) || items.length === 0) {
    return fallback;
  }

  if (options.bullet) {
    return { __html: renderBulletList(items) };
  }

  return items.join("; ");
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
