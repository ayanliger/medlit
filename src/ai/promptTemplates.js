const MAX_PROMPT_LENGTH = 12000;

// Study-type classification prompt (framework-aware)
export function buildStudyTypePrompt(documentSnapshot) {
  const { meta = {}, article = {} } = documentSnapshot ?? {};
  const context = createContextBlock(article.textContent);
  const metadataBlock = createMetadataBlock(meta);
  return `
You are a medical methodology classifier. Read the paper and identify the primary study type and the most appropriate reporting/assessment framework.

${metadataBlock}

PAPER TEXT:
${context}

Respond ONLY with valid JSON using EXACT values from the enums below:
{
  "studyType": "RCT",
  "framework": "CONSORT",
  "confidence": 0.95,
  "reasons": ["evidence-based reason 1", "evidence-based reason 2"]
}

IMPORTANT: Both studyType AND framework MUST be filled with enum values from these lists:
- studyType: RCT, Cohort, Case-Control, Cross-Sectional, Systematic Review, Meta-Analysis, Diagnostic Accuracy, Case Report, Case Series, Qualitative, Basic Science, Other
- framework: CONSORT, STROBE, PRISMA, STARD, CARE, COREQ, PICO, None

CRITICAL: Use EXACT enum values. Examples:
- "randomized controlled trial" or "phase 3 trial" → studyType = "RCT", framework = "CONSORT"
- "cohort study" → studyType = "Cohort", framework = "STROBE"
- "systematic review" → studyType = "Systematic Review", framework = "PRISMA"
- "meta-analysis" → studyType = "Meta-Analysis", framework = "PRISMA"
- "diagnostic accuracy" or "sensitivity/specificity" → studyType = "Diagnostic Accuracy", framework = "STARD"
- "case report" → studyType = "Case Report", framework = "CARE"
- "qualitative study" → studyType = "Qualitative", framework = "COREQ"
- "in vitro" or "animal model" → studyType = "Basic Science", framework = "None"

Mapping rules:
1. Interventional/RCT/clinical trial → studyType="RCT", framework="CONSORT"
2. Cohort/case-control/cross-sectional → studyType="Cohort|Case-Control|Cross-Sectional", framework="STROBE"
3. Systematic review/meta-analysis → studyType="Systematic Review|Meta-Analysis", framework="PRISMA"
4. Diagnostic test evaluation → studyType="Diagnostic Accuracy", framework="STARD"
5. Single or few patient cases → studyType="Case Report|Case Series", framework="CARE"
6. Interviews/focus groups/themes → studyType="Qualitative", framework="COREQ"
7. Bench/lab/molecular → studyType="Basic Science", framework="None"
8. If none fit → studyType="Other", framework="None"

Base classification on keywords: "randomized", "blinded", "placebo", "cohort", "prospective", "retrospective", "systematic review", "meta-analysis", "sensitivity", "specificity", "case report", "qualitative", "in vitro", "animal".
`.trim();
}

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
  "studyType": "",
  "framework": "",
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
  },
  "frameworkSpecific": {}
}

IMPORTANT INSTRUCTIONS:
- Populate studyType and framework when known; otherwise use "Other" and "None".
- Use "Not specified" or "Not reported" for missing text fields (never use literal "string").
- Use empty arrays [] for missing lists.
- Use "N/A" for inapplicable fields.
- For numeric fields, use actual numbers or omit the field entirely if not available.
- Extract actual values from the paper, not placeholder text.

ONLY return valid JSON. No Markdown, no explanations.
`.trim();
}

// PRISMA-aligned summary for Systematic Reviews / Meta-Analyses
export function buildSystematicReviewPrompt(documentSnapshot) {
  const { meta = {}, article = {} } = documentSnapshot ?? {};
  const context = createContextBlock(article.textContent);
  const metadataBlock = createMetadataBlock(meta);
  return `
You are extracting a PRISMA-aligned summary for a Systematic Review/Meta-Analysis. Return ONLY JSON.

${metadataBlock}

PAPER TEXT:
${context}

SCHEMA:
{
  "studyType": "Systematic Review|Meta-Analysis",
  "framework": "PRISMA",
  "studyDesign": {"type": "Systematic Review|Meta-Analysis", "setting": "N/A", "studyPeriod": "", "registrationID": ""},
  "population": {"sampleSize": {"intervention": null, "control": null, "total": null}, "demographics": {"age": "Not applicable", "gender": "Not applicable", "ethnicity": "Not applicable"}, "inclusionCriteria": [], "exclusionCriteria": []},
  "intervention": {"description": "N/A", "dosage": "N/A", "duration": "N/A"},
  "comparison": {"controlType": "N/A", "description": "N/A"},
  "outcomes": {"primary": {"measure": "primary outcome across studies", "interventionResult": "pooled effect if available", "controlResult": "N/A", "pValue": null, "confidenceInterval": "", "effectSize": ""}, "secondary": []},
  "interpretation": {"NNT": null, "interpretation": "high-level conclusions", "limitations": [], "applicability": ""},
  "frameworkSpecific": {
    "databasesSearched": ["MEDLINE", "EMBASE"],
    "dateRange": "",
    "numberOfStudies": 0,
    "totalParticipants": 0,
    "riskOfBiasMethod": "",
    "metaAnalysisModel": "fixed|random|none",
    "pooledEffectMeasure": "RR|OR|MD|SMD",
    "pooledEffectValue": "",
    "I2": null,
    "heterogeneityNotes": "",
    "registration": "PROSPERO ID or 'Not registered'"
  }
}

Rules:
- Set counts only if explicitly reported; otherwise use null or 0 appropriately.
- If no meta-analysis, set metaAnalysisModel to "none" and pooled fields to "N/A".
- Use actual names of databases and report inclusion/exclusion criteria if provided.
`.trim();
}

// STARD-aligned summary for Diagnostic Accuracy studies
export function buildDiagnosticAccuracyPrompt(documentSnapshot) {
  const { meta = {}, article = {} } = documentSnapshot ?? {};
  const context = createContextBlock(article.textContent);
  const metadataBlock = createMetadataBlock(meta);
  return `
You are extracting a STARD-aligned summary for a Diagnostic Accuracy study. Return ONLY JSON.

${metadataBlock}

PAPER TEXT:
${context}

SCHEMA:
{
  "studyType": "Diagnostic Accuracy",
  "framework": "STARD",
  "studyDesign": {"type": "Diagnostic Accuracy", "setting": "", "studyPeriod": "", "registrationID": "Not registered"},
  "population": {"sampleSize": {"intervention": null, "control": null, "total": null}, "demographics": {"age": "", "gender": "", "ethnicity": ""}, "inclusionCriteria": [], "exclusionCriteria": []},
  "intervention": {"description": "Index test", "dosage": "N/A", "duration": "N/A"},
  "comparison": {"controlType": "Reference standard", "description": "reference standard used"},
  "outcomes": {"primary": {"measure": "diagnostic accuracy", "interventionResult": "sensitivity", "controlResult": "specificity", "pValue": null, "confidenceInterval": "", "effectSize": "AUC if available"}, "secondary": []},
  "interpretation": {"NNT": "N/A", "interpretation": "clinical implications of accuracy", "limitations": [], "applicability": ""},
  "frameworkSpecific": {
    "indexTest": "",
    "referenceStandard": "",
    "targetCondition": "",
    "sensitivity": null,
    "specificity": null,
    "ppv": null,
    "npv": null,
    "auc": null,
    "cutoffs": "",
    "prevalence": null
  }
}

Rules:
- Use numeric fields for sensitivity/specificity/auc if reported; else null.
- Clearly name index test and reference standard.
`.trim();
}

// STROBE-aligned summary for observational studies
export function buildObservationalPrompt(documentSnapshot) {
  const { meta = {}, article = {} } = documentSnapshot ?? {};
  const context = createContextBlock(article.textContent);
  const metadataBlock = createMetadataBlock(meta);
  return `
You are extracting a STROBE-aligned summary for an observational study (cohort, case-control, cross-sectional). Return ONLY JSON.

${metadataBlock}

PAPER TEXT:
${context}

SCHEMA:
{
  "studyType": "Cohort|Case-Control|Cross-Sectional",
  "framework": "STROBE",
  "studyDesign": {"type": "", "setting": "", "studyPeriod": "", "registrationID": "Not registered"},
  "population": {"sampleSize": {"intervention": null, "control": null, "total": null}, "demographics": {"age": "", "gender": "", "ethnicity": ""}, "inclusionCriteria": [], "exclusionCriteria": []},
  "intervention": {"description": "Exposure of interest", "dosage": "N/A", "duration": ""},
  "comparison": {"controlType": "Comparator/Unexposed group", "description": ""},
  "outcomes": {"primary": {"measure": "primary outcome", "interventionResult": "effect in exposed", "controlResult": "effect in unexposed", "pValue": null, "confidenceInterval": "", "effectSize": "RR|OR|HR value"}, "secondary": []},
  "interpretation": {"NNT": "N/A", "interpretation": "", "limitations": [], "applicability": ""},
  "frameworkSpecific": {
    "exposure": "",
    "outcome": "",
    "effectMeasure": "RR|OR|HR",
    "confoundersAdjusted": [""],
    "biasConsiderations": [""],
    "statisticalMethods": [""],
    "missingDataHandling": ""
  }
}

Rules:
- Use effect measures only if explicitly reported.
- List key confounders adjusted for.
`.trim();
}

// CARE-aligned summary for Case Reports / Case Series
export function buildCaseReportPrompt(documentSnapshot) {
  const { meta = {}, article = {} } = documentSnapshot ?? {};
  const context = createContextBlock(article.textContent);
  const metadataBlock = createMetadataBlock(meta);
  return `
You are extracting a CARE-aligned summary for a Case Report or Case Series. Return ONLY JSON.

${metadataBlock}

PAPER TEXT:
${context}

SCHEMA:
{
  "studyType": "Case Report|Case Series",
  "framework": "CARE",
  "studyDesign": {"type": "Case Report|Case Series", "setting": "", "studyPeriod": "", "registrationID": "N/A"},
  "population": {"sampleSize": {"intervention": null, "control": null, "total": 1}, "demographics": {"age": "", "gender": "", "ethnicity": ""}, "inclusionCriteria": [], "exclusionCriteria": []},
  "intervention": {"description": "Treatment/management provided", "dosage": "", "duration": ""},
  "comparison": {"controlType": "None", "description": "N/A"},
  "outcomes": {"primary": {"measure": "Patient outcome", "interventionResult": "outcome description", "controlResult": "N/A", "pValue": null, "confidenceInterval": "N/A", "effectSize": "N/A"}, "secondary": []},
  "interpretation": {"NNT": "N/A", "interpretation": "clinical takeaway", "limitations": [], "applicability": "generalizability notes"},
  "frameworkSpecific": {
    "presentingComplaint": "",
    "clinicalHistory": "",
    "diagnosticAssessment": [""],
    "therapeuticIntervention": "",
    "followUp": "",
    "outcomeDescription": "",
    "patientPerspective": "",
    "informedConsentObtained": null,
    "keyLearningPoints": [""]
  }
}

Rules:
- Set total to the number of cases (1 for case report, N for case series).
- Capture patient perspective if mentioned.
- Include key learning points for clinical education.
`.trim();
}

// COREQ-aligned summary for Qualitative Research
export function buildQualitativePrompt(documentSnapshot) {
  const { meta = {}, article = {} } = documentSnapshot ?? {};
  const context = createContextBlock(article.textContent);
  const metadataBlock = createMetadataBlock(meta);
  return `
You are extracting a COREQ-aligned summary for Qualitative Research. Return ONLY JSON.

${metadataBlock}

PAPER TEXT:
${context}

SCHEMA:
{
  "studyType": "Qualitative",
  "framework": "COREQ",
  "studyDesign": {"type": "Qualitative", "setting": "", "studyPeriod": "", "registrationID": "N/A"},
  "population": {"sampleSize": {"intervention": null, "control": null, "total": null}, "demographics": {"age": "", "gender": "", "ethnicity": ""}, "inclusionCriteria": [], "exclusionCriteria": []},
  "intervention": {"description": "N/A", "dosage": "N/A", "duration": "N/A"},
  "comparison": {"controlType": "N/A", "description": "N/A"},
  "outcomes": {"primary": {"measure": "Key themes/findings", "interventionResult": "major themes identified", "controlResult": "N/A", "pValue": null, "confidenceInterval": "N/A", "effectSize": "N/A"}, "secondary": []},
  "interpretation": {"NNT": "N/A", "interpretation": "implications of findings", "limitations": [], "applicability": "transferability notes"},
  "frameworkSpecific": {
    "researchParadigm": "",
    "methodologyApproach": "phenomenology|grounded theory|ethnography|case study|other",
    "samplingStrategy": "",
    "dataCollectionMethod": "interviews|focus groups|observations|documents",
    "numberOfParticipants": null,
    "dataAnalysisMethod": "",
    "themesIdentified": [""],
    "triangulation": "",
    "memberChecking": null,
    "reflexivity": "",
    "saturation": ""
  }
}

Rules:
- Identify major themes from findings.
- Capture qualitative rigor elements (triangulation, member checking, reflexivity).
- Note if data saturation was achieved.
`.trim();
}

// Basic Science / Bench Research (no clinical framework)
export function buildBasicSciencePrompt(documentSnapshot) {
  const { meta = {}, article = {} } = documentSnapshot ?? {};
  const context = createContextBlock(article.textContent);
  const metadataBlock = createMetadataBlock(meta);
  return `
You are extracting a general summary for Basic Science or Bench Research. Return ONLY JSON.

${metadataBlock}

PAPER TEXT:
${context}

SCHEMA:
{
  "studyType": "Basic Science",
  "framework": "None",
  "studyDesign": {"type": "Basic Science", "setting": "Laboratory", "studyPeriod": "", "registrationID": "N/A"},
  "population": {"sampleSize": {"intervention": null, "control": null, "total": null}, "demographics": {"age": "N/A", "gender": "N/A", "ethnicity": "N/A"}, "inclusionCriteria": [], "exclusionCriteria": []},
  "intervention": {"description": "Experimental manipulation", "dosage": "N/A", "duration": ""},
  "comparison": {"controlType": "Control condition", "description": ""},
  "outcomes": {"primary": {"measure": "Primary measured variable", "interventionResult": "experimental result", "controlResult": "control result", "pValue": null, "confidenceInterval": "", "effectSize": ""}, "secondary": []},
  "interpretation": {"NNT": "N/A", "interpretation": "mechanistic insights", "limitations": [], "applicability": "translational potential"},
  "frameworkSpecific": {
    "researchQuestion": "",
    "model": "in vitro|in vivo|computational|other",
    "organism": "",
    "keyTechniques": [""],
    "mainFindings": [""],
    "mechanisticInsights": "",
    "novelty": "",
    "replicationDetails": ""
  }
}

Rules:
- Describe the experimental model (cell line, animal model, computational, etc.).
- List key techniques (Western blot, PCR, imaging, etc.).
- Emphasize mechanistic insights and novelty.
- Note if replication details are sufficient.
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
