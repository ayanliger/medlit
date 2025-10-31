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

  const classification = normalizeClassification(result);

  const sections = [
    classification && {
      title: "Study Classification",
      entries: [
        ["Study Type", classification.studyType],
        ["Framework", classification.framework],
        classification.confidence != null && ["Classifier Confidence", `${Math.round(classification.confidence * 100)}%`],
        classification.reasons?.length > 0 && [
          "Reasons",
          { __html: renderBulletList(classification.reasons) }
        ]
      ].filter(Boolean)
    },
    {
      title: "Study Design",
      entries: [
        ["Type", result.data.studyDesign?.type || classification?.studyType],
        ["Setting", result.data.studyDesign?.setting],
        ["Period", result.data.studyDesign?.studyPeriod],
        ["Registration", sanitizePlaceholder(result.data.studyDesign?.registrationID) || "Not listed"]
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
      ].filter(entry => entry && hasRealValue(entry[1]))
    },
    // Only include Secondary Outcomes section if there are actual outcomes
    result.data.outcomes?.secondary?.length > 0 && {
      title: "Secondary Outcomes",
      customBody: renderSecondaryOutcomes(result.data.outcomes?.secondary)
    },
    {
      title: "Interpretation",
      entries: [
        // Only show NNT if it has a real numeric value
        sanitizePlaceholder(result.data.interpretation?.NNT) && !["not reported", "not calculated", "not applicable"].includes(String(result.data.interpretation?.NNT).toLowerCase()) && ["NNT", result.data.interpretation.NNT],
        ["Interpretation", result.data.interpretation?.interpretation],
        [
          "Limitations",
          arrayDefinitionValue(result.data.interpretation?.limitations, "Not listed", { bullet: true })
        ],
        ["Applicability", result.data.interpretation?.applicability]
      ].filter(Boolean)
    },
    result.data.frameworkSpecific && Object.keys(result.data.frameworkSpecific).length > 0 && {
      title: `${classification?.framework || result.data.framework || "Framework"} Details`,
      customBody: renderFrameworkSpecific(result.data.frameworkSpecific)
    }
  ].filter(Boolean);

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

  // Check for validation rejection
  const validation = result.validation || result.data.contentValidation;
  const isRejected = result.source === "validation-rejected" || 
                     (validation && !validation.isMethodology && validation.confidence < 40);

  // If content was rejected, show a warning banner
  if (isRejected) {
    const html = [
      renderResultMeta(result),
      renderInfoBanner(
        `⚠️ The selected text does not appear to be a methodology section. Please select text from the Methods/Methodology section of the paper.`,
        "warning"
      ),
      `<div class="result-card">
        <h3>Validation Details</h3>
        ${renderDefinitionList([
          ["Content Type", "Non-methodology content detected"],
          ["Confidence", `${validation?.confidence || 0}% (threshold: 40%)`],
          ["Reason", validation?.reason || validation?.rationale || "Content validation failed"]
        ])}
      </div>`,
      `<div class="result-card">
        <h3>Tips for Selection</h3>
        <ul>
          <li>Look for sections titled "Methods", "Methodology", "Materials and Methods", or "Study Design"</li>
          <li>Methodology sections typically describe study design, sample size, randomization, data collection, and statistical analysis</li>
          <li>Avoid selecting from Introduction, Results, Discussion, or Conclusion sections</li>
        </ul>
      </div>`
    ].join("");
    
    target.classList.remove("empty-state");
    target.innerHTML = html;
    return;
  }

  // Show validation confidence if available (but not rejected)
  const validationBanner = validation && validation.confidence < 70 
    ? renderInfoBanner(
        `⚠️ Confidence: ${validation.confidence}%. The text may not be entirely from a methodology section.`,
        "warning"
      )
    : "";

  const cards = [
    renderScoreCard("Research Question Clarity", result.data.researchQuestionClarity),
    renderScoreCard("Sample Size & Power", result.data.sampleSizePower),
    renderScoreCard("Randomization", result.data.randomization),
    renderScoreCard("Blinding", result.data.blinding, { treatBooleansAsBadges: true }),
    renderScoreCard("Statistical Approach", result.data.statisticalApproach)
  ];

  const html = [
    renderResultMeta(result),
    validationBanner,
    `<div class="result-card">
      <h3>Overall Quality</h3>
      ${renderScoreMeter(result.data.overallQualityScore, 100, false, true)}
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
  
  // Don't render sections that are completely empty
  if (content.includes('No detailed data available') && !section.customBody) {
    return '';
  }
  
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
      { __html: `<span class="score">${escapeHtml(String(block.score))}/5 ${renderScoreMeter(
        block.score,
        5,
        true
      )}</span>` }
    ]);
  }

  // Special condensed handling for Blinding section
  if (options.treatBooleansAsBadges) {
    const booleanFields = Object.entries(block).filter(([key, value]) => typeof value === "boolean");
    
    if (booleanFields.length > 0) {
      const badges = booleanFields
        .map(([key, value]) => {
          const label = `${capitalize(key)}: ${value ? "Yes" : "No"}`;
          return renderBadge(label, value ? "info" : "warning");
        })
        .join(" ");
      
      entries.push([
        "Blinding Status",
        { __html: badges }
      ]);
    }
  }

  if (block.method) {
    entries.push(["Method", block.method]);
  }

  if (block.methods?.length) {
    entries.push(["Methods", arrayDefinitionValue(block.methods, "Not specified")]);
  }

  // Only show sample size numbers if they're actually present (not null/N/A)
  const calcSize = sanitizePlaceholder(block.calculated);
  const actualSize = sanitizePlaceholder(block.actual);
  
  if (calcSize !== null || actualSize !== null) {
    const parts = [];
    if (calcSize !== null) parts.push(`Calculated: ${formatNumber(calcSize)}`);
    if (actualSize !== null) parts.push(`Actual: ${formatNumber(actualSize)}`);
    entries.push(["Sample Size", parts.join(", ")]);
  }
  
  // Only show assessment if it has meaningful content
  const assessment = sanitizePlaceholder(block.assessment);
  if (assessment && !String(assessment).toLowerCase().includes("not applicable")) {
    entries.push(["Assessment", assessment]);
  }
  
  // Show justification/reasoning if available (useful for Randomization)
  if (block.justification || block.reasoning) {
    entries.push(["Justification", block.justification || block.reasoning]);
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

  // Filter out entries with empty/placeholder values
  const filteredEntries = normalized.filter(([key, value]) => {
    return hasRealValue(value);
  });

  if (!filteredEntries.length) {
    return `<p class="empty-text">No detailed data available.</p>`;
  }

  const html = filteredEntries
    .map(
      ([key, value]) =>
        `<dt>${escapeHtml(String(key))}</dt><dd>${renderDefinitionValue(value)}</dd>`
    )
    .join("");

  return `<dl class="dl">${html}</dl>`;
}

function renderFrameworkSpecific(obj = {}) {
  if (!obj || typeof obj !== "object" || !Object.keys(obj).length) {
    return `<p class="empty-text">No framework-specific details.</p>`;
  }
  const entries = Object.entries(obj).map(([k, v]) => [formatKey(k), normalizeValue(v)]);
  return renderDefinitionList(entries);
}

function normalizeValue(v) {
  if (Array.isArray(v)) {
    const items = v.filter((x) => x != null && String(x).trim().length > 0);
    return items.length ? { __html: renderBulletList(items) } : "—";
  }
  if (v && typeof v === "object") {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return v;
}

function formatKey(key) {
  return String(key)
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^\w/, (c) => c.toUpperCase());
}

function normalizeClassification(result) {
  const dataType = result?.data?.studyType;
  const dataFramework = result?.data?.framework;
  const cls = result?.classification?.data;
  const designType = result?.data?.studyDesign?.type;
  
  if (!dataType && !dataFramework && !cls && !designType) return null;
  
  // Fallback: if classifier returned "Other" but studyDesign.type has a real value, use that
  let finalType = dataType || cls?.studyType || "";
  if ((finalType === "Other" || finalType === "") && designType && designType !== "Other" && designType !== "Unknown") {
    finalType = normalizeStudyTypeValue(designType);
  }
  
  // Infer framework from study type if not provided
  let finalFramework = dataFramework || cls?.framework || "";
  if ((finalFramework === "None" || finalFramework === "") && finalType && finalType !== "Other") {
    finalFramework = inferFrameworkFromType(finalType);
  }
  
  return {
    studyType: finalType,
    framework: finalFramework,
    confidence: cls?.confidence ?? null,
    reasons: cls?.reasons ?? []
  };
}

function normalizeStudyTypeValue(value) {
  if (!value) return "";
  const v = String(value).trim();
  // Map common studyDesign.type values to canonical classification types
  if (v === "RCT" || v.includes("Randomized")) return "RCT";
  if (v === "Cohort") return "Cohort";
  if (v === "Case-Control") return "Case-Control";
  if (v === "Cross-Sectional") return "Cross-Sectional";
  if (v === "Systematic Review") return "Systematic Review";
  if (v === "Meta-Analysis") return "Meta-Analysis";
  if (v === "Diagnostic Accuracy") return "Diagnostic Accuracy";
  if (v === "Case Report") return "Case Report";
  if (v === "Case Series") return "Case Series";
  if (v === "Qualitative") return "Qualitative";
  if (v === "Basic Science") return "Basic Science";
  return v;
}

function inferFrameworkFromType(studyType) {
  const mapping = {
    "RCT": "CONSORT",
    "Cohort": "STROBE",
    "Case-Control": "STROBE",
    "Cross-Sectional": "STROBE",
    "Systematic Review": "PRISMA",
    "Meta-Analysis": "PRISMA",
    "Diagnostic Accuracy": "STARD",
    "Case Report": "CARE",
    "Case Series": "CARE",
    "Qualitative": "COREQ",
    "Basic Science": "None"
  };
  return mapping[studyType] || "None";
}

function renderDefinitionValue(value) {
  if (value && typeof value === "object" && "__html" in value) {
    return value.__html;
  }
  
  // Sanitize placeholder values from AI output
  const sanitized = sanitizePlaceholder(value);
  
  if (
    sanitized === undefined ||
    sanitized === null ||
    (typeof sanitized === "string" && sanitized.trim().length === 0)
  ) {
    return `<span class="empty-text">—</span>`;
  }
  return sanitizeHtml(String(sanitized));
}

/**
 * Checks if a value contains real, meaningful data (not empty or placeholder)
 * @param {*} value - The value to check
 * @returns {boolean} True if the value is meaningful, false otherwise
 */
function hasRealValue(value) {
  // Handle special HTML objects (like bullet lists)
  if (value && typeof value === "object" && "__html" in value) {
    const htmlContent = value.__html;
    // Check if the HTML contains actual content (not just empty states)
    if (typeof htmlContent === "string") {
      const stripped = htmlContent.replace(/<[^>]*>/g, "").trim();
      return stripped.length > 0 && 
             !stripped.includes("No items") && 
             !stripped.includes("Not specified") &&
             !stripped.includes("Not listed");
    }
  }
  
  const sanitized = sanitizePlaceholder(value);
  
  // Null, undefined, or empty string
  if (
    sanitized === undefined ||
    sanitized === null ||
    (typeof sanitized === "string" && sanitized.trim().length === 0)
  ) {
    return false;
  }
  
  // Check for common placeholder strings
  const strValue = String(sanitized).trim().toLowerCase();
  const placeholders = [
    "not specified",
    "not reported",
    "not listed",
    "not provided",
    "not applicable",
    "not registered",
    "n/a",
    "na",
    "none",
    "—",
    "-",
    "unknown"
  ];
  
  return !placeholders.includes(strValue);
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

function renderScoreMeter(value, max, compact = false, showPercentage = false) {
  const parsedValue = typeof value === "number" ? value : parseFloat(value);
  if (Number.isNaN(parsedValue)) {
    return `<span class="badge warning">N/A</span>`;
  }
  const ratio = Math.max(0, Math.min(parsedValue / max, 1));
  
  // Color code the meter based on score quality
  let colorClass = "";
  if (max === 5) {
    // /5 scale coloring
    if (parsedValue >= 4) colorClass = "score-high";
    else if (parsedValue >= 3) colorClass = "score-medium";
    else colorClass = "score-low";
  } else if (max === 100) {
    // Percentage scale coloring
    if (parsedValue >= 80) colorClass = "score-high";
    else if (parsedValue >= 60) colorClass = "score-medium";
    else colorClass = "score-low";
  }
  
  // Display format: show percentage for /100 scores, fraction for /5 scores
  let display = "";
  if (!compact) {
    if (showPercentage || max === 100) {
      display = `<span class="score-value">${Math.round(parsedValue)}%</span>`;
    } else {
      display = `<span class="score-value">${escapeHtml(String(value))}/${escapeHtml(String(max))}</span>`;
    }
  }
  
  return `<span class="score-meter ${colorClass}">${display}<span class="score-meter-bar"><span class="score-meter-fill" style="transform: scaleX(${ratio});"></span></span></span>`;
}

// Formatting utilities

function formatSampleSize(sample) {
  if (!sample) {
    return null; // Return null to trigger filtering
  }
  
  const total = sanitizePlaceholder(sample.total);
  const intervention = sanitizePlaceholder(sample.intervention);
  const control = sanitizePlaceholder(sample.control);
  
  // Only format if we have at least one real value
  if (!total && !intervention && !control) {
    return null;
  }
  
  const parts = [];
  
  if (total) {
    parts.push(`Total ${formatNumber(total)}`);
  }
  
  const groupParts = [];
  if (intervention) {
    groupParts.push(`Intervention ${formatNumber(intervention)}`);
  }
  if (control) {
    groupParts.push(`Control ${formatNumber(control)}`);
  }
  
  if (groupParts.length > 0) {
    if (parts.length > 0) {
      parts[0] += ` (${groupParts.join(", ")})`;
    } else {
      parts.push(groupParts.join(", "));
    }
  }
  
  return parts.join(", ") || null;
}

function summarizeDemographics(demo) {
  if (!demo) {
    return null;
  }

  const parts = [];
  const age = sanitizePlaceholder(demo.age);
  const gender = sanitizePlaceholder(demo.gender);
  const ethnicity = sanitizePlaceholder(demo.ethnicity);
  
  // Check for "not applicable" type values and skip them
  const notApplicableCheck = (val) => {
    if (!val) return false;
    const str = String(val).toLowerCase();
    return !str.includes("not applicable") && !str.includes("n/a");
  };
  
  if (age && notApplicableCheck(age)) parts.push(`Age: ${age}`);
  if (gender && notApplicableCheck(gender)) parts.push(`Gender: ${gender}`);
  if (ethnicity && notApplicableCheck(ethnicity)) parts.push(`Ethnicity: ${ethnicity}`);
  
  return parts.length ? parts.join(" • ") : null;
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

function sanitizePlaceholder(value) {
  // Catch literal placeholder values that AI might return
  if (value === null || value === undefined) {
    return null;
  }
  
  const str = String(value).trim();
  
  // Check for literal type placeholders
  const placeholders = [
    "string",
    "number",
    "null",
    "undefined",
    "[object Object]",
    "NaN"
  ];
  
  if (placeholders.includes(str.toLowerCase())) {
    return null;
  }
  
  return value;
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
