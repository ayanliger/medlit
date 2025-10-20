const MAX_PROMPT_LENGTH = 12000;

export function buildStructuredSummaryPrompt(documentSnapshot) {
  const { meta = {}, article = {} } = documentSnapshot ?? {};
  const context = createContextBlock(article.textContent);
  const metadataBlock = createMetadataBlock(meta);

  return `
You are a medical research extraction specialist. Using the provided paper, produce a structured JSON summary following the schema below.

${metadataBlock}

PAPER TEXT:
${context}

REQUIRED JSON SCHEMA:
{
  "studyDesign": {
    "type": "RCT|Cohort|Case-Control|Cross-Sectional|Meta-Analysis|Systematic Review|Other",
    "setting": "string",
    "studyPeriod": "string",
    "registrationID": "string|null"
  },
  "population": {
    "sampleSize": {"intervention": number|null, "control": number|null, "total": number|null},
    "demographics": {"age": "string", "gender": "string", "ethnicity": "string"},
    "inclusionCriteria": ["string"],
    "exclusionCriteria": ["string"]
  },
  "intervention": {
    "description": "string",
    "dosage": "string",
    "duration": "string"
  },
  "comparison": {
    "controlType": "placebo|active|standard care|none",
    "description": "string"
  },
  "outcomes": {
    "primary": {
      "measure": "string",
      "interventionResult": "string",
      "controlResult": "string",
      "pValue": "number|null",
      "confidenceInterval": "string",
      "effectSize": "string"
    },
    "secondary": [
      {
        "measure": "string",
        "result": "string"
      }
    ]
  },
  "interpretation": {
    "NNT": "number|null",
    "interpretation": "string",
    "limitations": ["string"],
    "applicability": "string"
  }
}

ONLY return JSON. No Markdown, no explanations.
`.trim();
}

export function buildMethodologyPrompt({ methodsText, fullText }) {
  const methodsContext = createContextBlock(methodsText);
  const fullPaperContext = createContextBlock(fullText);

  return `
You are a clinical trial methodologist applying the Cochrane Risk of Bias framework.

METHODS SECTION:
${methodsContext}

FULL PAPER SNIPPET:
${fullPaperContext}

Return ONLY JSON with this exact structure:
{
  "researchQuestionClarity": {
    "score": 1-5,
    "strengths": ["string"],
    "concerns": ["string"]
  },
  "sampleSizePower": {
    "score": 1-5,
    "calculated": "number|null",
    "actual": "number|null",
    "assessment": "string"
  },
  "randomization": {
    "score": 1-5,
    "method": "string",
    "concerns": ["string"]
  },
  "blinding": {
    "participants": true,
    "assessors": true,
    "analysts": false,
    "concerns": ["string"]
  },
  "statisticalApproach": {
    "score": 1-5,
    "methods": ["string"],
    "strengths": ["string"],
    "concerns": ["string"]
  },
  "overallQualityScore": 0-100,
  "keyLimitations": ["string"],
  "recommendation": "string"
}

Remember: ONLY JSON, no comments.
`.trim();
}

export function buildSimplificationPrompt(text) {
  const context = createContextBlock(text);

  return `
You are a medical educator. Rewrite the excerpt in plain English while preserving clinical accuracy.

TEXT:
${context}

Return ONLY JSON with:
{
  "plainEnglish": "string under 120 words",
  "keyTerms": [
    {"term": "string", "definition": "string"}
  ],
  "statisticsNotes": ["string"]
}
`.trim();
}

export function buildKeyPointsPrompt(summaryMarkdown, fullText) {
  const summaryContext = createContextBlock(summaryMarkdown);
  const fullTextContext = createContextBlock(fullText);

  return `
You are organizing key study points for systematic review exports.

SUMMARY INPUT:
${summaryContext}

FULL PAPER TEXT:
${fullTextContext}

Return ONLY JSON:
{
  "keyHypothesis": ["string"],
  "criticalFindings": ["string"],
  "studyLimitations": ["string"],
  "implications": ["string"],
  "futureResearch": ["string"]
}
`.trim();
}

function createContextBlock(rawText = "") {
  if (!rawText) {
    return "[No additional context supplied]";
  }
  return truncateText(rawText.replace(/\s+/g, " ").trim());
}

function createMetadataBlock(meta = {}) {
  const items = [
    meta.title ? `Title: ${meta.title}` : "",
    meta.url ? `URL: ${meta.url}` : "",
    meta.metaDescription ? `Meta Description: ${meta.metaDescription}` : ""
  ].filter(Boolean);

  if (!items.length) {
    return "";
  }

  return `PAPER METADATA:\n${items.join("\n")}`;
}

function truncateText(text) {
  if (text.length <= MAX_PROMPT_LENGTH) {
    return text;
  }
  return `${text.slice(0, MAX_PROMPT_LENGTH)}…`;
}
