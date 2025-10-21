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
    "setting": "description of clinical setting",
    "studyPeriod": "timeframe like '2010-2015'",
    "registrationID": "trial registry ID or 'Not registered'"
  },
  "population": {
    "sampleSize": {"intervention": 123, "control": 120, "total": 243},
    "demographics": {"age": "mean age or age range", "gender": "gender distribution", "ethnicity": "ethnic breakdown"},
    "inclusionCriteria": ["criterion 1", "criterion 2"],
    "exclusionCriteria": ["criterion 1", "criterion 2"]
  },
  "intervention": {
    "description": "detailed intervention description",
    "dosage": "dosage amount and frequency",
    "duration": "treatment duration"
  },
  "comparison": {
    "controlType": "placebo|active|standard care|none",
    "description": "description of comparator"
  },
  "outcomes": {
    "primary": {
      "measure": "primary outcome measure",
      "interventionResult": "result for intervention group",
      "controlResult": "result for control group",
      "pValue": 0.05,
      "confidenceInterval": "95% CI description",
      "effectSize": "effect size with units"
    },
    "secondary": [
      {
        "measure": "secondary outcome name",
        "result": "outcome result"
      }
    ]
  },
  "interpretation": {
    "NNT": 10,
    "interpretation": "clinical interpretation of findings",
    "limitations": ["limitation 1", "limitation 2"],
    "applicability": "clinical applicability"
  }
}

IMPORTANT INSTRUCTIONS:
- Use "Not specified" or "Not reported" for missing text fields (never use literal "string")
- Use empty arrays [] for missing lists
- Use "N/A" for inapplicable fields
- For numeric fields, use actual numbers or omit the field entirely if not available
- Extract actual values from the paper, not placeholder text

ONLY return valid JSON. No Markdown, no explanations.
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
    "score": 3,
    "strengths": ["specific strength description"],
    "concerns": ["specific concern description"]
  },
  "sampleSizePower": {
    "score": 4,
    "calculated": null,
    "actual": null,
    "assessment": "sample size justification or 'Not applicable for review/observational study'"
  },
  "randomization": {
    "score": 4,
    "method": "randomization method description",
    "concerns": ["specific randomization concern"]
  },
  "blinding": {
    "participants": true,
    "assessors": true,
    "analysts": false,
    "concerns": ["specific blinding concern"]
  },
  "statisticalApproach": {
    "score": 4,
    "methods": ["statistical method 1", "method 2"],
    "strengths": ["strength description"],
    "concerns": ["concern description"]
  },
  "overallQualityScore": 75,
  "keyLimitations": ["limitation 1", "limitation 2"],
  "recommendation": "quality recommendation"
}

CRITICAL INSTRUCTIONS:
- Use actual scores (1-5) based on the methods text
- For reviews/observational studies: set calculated and actual to null, use "Not applicable" in assessment
- For RCTs: only include sample size numbers if explicitly mentioned in the methods
- Randomization: use "Not applicable" for non-randomized designs
- Blinding: set all to false for reviews or unblinded studies
- Never fabricate numbers - if not mentioned, use null or "Not reported"
- Use empty arrays [] for missing strengths/concerns/limitations
- Base ALL content on the actual methods text provided

ONLY JSON, no comments.
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
  "plainEnglish": "simplified explanation in plain English (under 120 words)",
  "keyTerms": [
    {"term": "medical term", "definition": "plain English definition"}
  ],
  "statisticsNotes": ["statistical interpretation note"]
}

IMPORTANT:
- Provide actual simplified text, not placeholder "string"
- Use empty arrays [] if no terms or notes to add
- Extract real medical terms with their definitions
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
  "keyHypothesis": ["main hypothesis or research question"],
  "criticalFindings": ["key finding 1", "key finding 2"],
  "studyLimitations": ["limitation 1", "limitation 2"],
  "implications": ["clinical implication", "research implication"],
  "futureResearch": ["suggested future study direction"]
}

IMPORTANT:
- Extract actual content, never use placeholder "string"
- Use empty arrays [] if no items to list
- Be specific and descriptive in each point
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
