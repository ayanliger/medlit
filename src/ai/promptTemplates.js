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
  "studyType": "[value from enum]",
  "framework": "[value from enum]",
  "confidence": [0.0 to 1.0 based on evidence],
  "reasons": ["evidence-based reason 1", "evidence-based reason 2"]
}

IMPORTANT: Both studyType AND framework MUST be filled with enum values from these lists:
- studyType: RCT, Cohort, Case-Control, Cross-Sectional, Systematic Review, Meta-Analysis, Diagnostic Accuracy, Case Report, Case Series, Qualitative, Basic Science, Other
- framework: CONSORT, STROBE, PRISMA, STARD, CARE, COREQ, PICO, None

⚠️ ANTI-HALLUCINATION RULES:
1. Check the TITLE and ABSTRACT first - they explicitly state the study type
2. If the title contains "randomized", "trial", "RCT", "phase 2", or "phase 3" → it is an RCT, NOT a review
3. Look for "Patients were randomized" or "participants were randomized" → RCT
4. Look for trial registry IDs (NCT, ISRCTN, etc.) → indicates RCT
5. ONLY classify as "Systematic Review" if the Methods describe searching multiple databases for existing studies
6. ONLY classify as "Meta-Analysis" if the paper pools data from OTHER studies
7. If you see BOTH "randomized trial" AND "systematic review" mentioned, prioritize what the paper IS (primary research) not what it CITES

CRITICAL: Use EXACT enum values. Examples:
- "randomized controlled trial" or "phase 3 trial" → studyType = "RCT", framework = "CONSORT"
- "cohort study" → studyType = "Cohort", framework = "STROBE"
- "systematic review" → studyType = "Systematic Review", framework = "PRISMA"
- "meta-analysis" → studyType = "Meta-Analysis", framework = "PRISMA"
- "diagnostic accuracy" or "sensitivity/specificity" → studyType = "Diagnostic Accuracy", framework = "STARD"
- "case report" → studyType = "Case Report", framework = "CARE"
- "qualitative study" → studyType = "Qualitative", framework = "COREQ"
- "in vitro" or "animal model" → studyType = "Basic Science", framework = "None"

Mapping rules (prioritize primary research over secondary literature):
1. Interventional/RCT/clinical trial → studyType="RCT", framework="CONSORT"
2. Cohort/case-control/cross-sectional → studyType="Cohort|Case-Control|Cross-Sectional", framework="STROBE"
3. Diagnostic test evaluation → studyType="Diagnostic Accuracy", framework="STARD"
4. Single or few patient cases → studyType="Case Report|Case Series", framework="CARE"
5. Interviews/focus groups/themes → studyType="Qualitative", framework="COREQ"
6. Bench/lab/molecular → studyType="Basic Science", framework="None"
7. Systematic review/meta-analysis (ONLY if the paper reviews/synthesizes OTHER studies) → studyType="Systematic Review|Meta-Analysis", framework="PRISMA"
8. If none fit → studyType="Other", framework="None"

CRITICAL CLASSIFICATION GUIDANCE:
- A study is a "Systematic Review" ONLY if it systematically searches, selects, and synthesizes MULTIPLE existing studies
- A study is "Meta-Analysis" ONLY if it statistically pools quantitative data from multiple studies
- If the paper describes original data collection (new patients, experiments, observations), it is NOT a systematic review/meta-analysis
- Keywords "systematic review" or "meta-analysis" in the Introduction/Background do NOT indicate study type

DECISION TREE (follow in order):
1. Check title for "randomized", "trial", "RCT", "phase" → RCT
2. Check for trial registration (NCT, ISRCTN, etc.) → RCT
3. Check Methods for "patients were randomized" → RCT
4. Check Methods for "database search" + "study selection" → Systematic Review
5. Check for "pooled analysis" or "meta-analysis model" → Meta-Analysis
6. Check for "enrolled", "recruited", "consented" → primary research (RCT/Cohort/etc.)
7. If none of above, use study design keywords

Base classification primarily on:
- TITLE and ABSTRACT (most reliable)
- Study design explicitly stated in Methods
- Whether NEW data was collected (primary research) vs existing studies reviewed (secondary research)
- Presence of original patient enrollment, intervention, or data collection

COMMON MISTAKES TO AVOID:
- DO NOT classify an RCT as a systematic review just because the Introduction mentions prior reviews
- DO NOT confuse "systematic approach" (methodology) with "systematic review" (study type)
- DO NOT assume a paper is a review just because it analyzes multiple groups or trials within ONE study

Keyword indicators (use as secondary evidence only):
- RCT: "randomized", "blinded", "placebo", "enrolled", "recruited", "trial registry"
- Cohort: "cohort", "prospective", "followed over time"
- Systematic Review: "database search", "MEDLINE", "EMBASE", "study selection criteria", "included studies"
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
    "sampleSize": {"intervention": number or null, "control": number or null, "total": number or null},
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
      "pValue": number or null,
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
    "NNT": number or null,
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
  "contentValidation": {
    "isMethodology": boolean (true if text is methodology, false otherwise),
    "confidence": number 0-100 (confidence this is methodology content),
    "rationale": "explanation of validation decision"
  },
  "researchQuestionClarity": {
    "score": number 1-5 (based on actual text quality),
    "strengths": ["specific strength"],
    "concerns": ["specific concern"]
  },
  "sampleSizePower": {
    "score": number 1-5 (based on actual text quality),
    "calculated": number or null,
    "actual": number or null,
    "assessment": "assessment text or 'Not applicable'"
  },
  "randomization": {
    "score": number 1-5 (based on actual text quality),
    "method": "randomization method description or 'Not applicable'",
    "concerns": ["concern if any"]
  },
  "blinding": {
    "participants": boolean,
    "assessors": boolean,
    "analysts": boolean,
    "concerns": ["concern if any"]
  },
  "statisticalApproach": {
    "score": number 1-5 (based on actual text quality),
    "methods": ["method 1", "method 2"],
    "strengths": ["strength"],
    "concerns": ["concern"]
  },
  "overallQualityScore": number 0-100 (weighted average based on all scores),
  "keyLimitations": ["limitation 1", "limitation 2"],
  "recommendation": "quality recommendation"
}

CRITICAL INSTRUCTIONS:
- FIRST: Validate if the METHODS SECTION text is actually methodology content
- Set contentValidation.isMethodology to false if the text is from Introduction, Results, Discussion, or Conclusion sections
- Set contentValidation.confidence (0-100) based on presence of methodology indicators (study design, randomization, sample size, statistical methods, data collection)
- If isMethodology is false, set all scores to 1, use empty arrays, and set overallQualityScore to 0
- If confidence is below 60, note this uncertainty in the rationale

SCORING RUBRIC (1-5 scale):
- Score 5: Excellent - comprehensive, well-justified, transparent, follows best practices
- Score 4: Good - adequately described, minor gaps, generally sound
- Score 3: Adequate - basic description present, some concerns or missing details
- Score 2: Poor - minimal description, significant gaps, major concerns
- Score 1: Very Poor - not described, critically inadequate, or not applicable

APPLY THESE SCORES STRICTLY:
- Research Question: Score based on clarity, specificity, and whether hypothesis/aims are explicit
- Sample Size: Score based on whether power calculation mentioned and sample size justified
- Randomization: Score based on whether method is described (if applicable to study type)
- Statistical Approach: Score based on whether methods are appropriate, specified, and justified
- Overall Quality Score: Calculate as weighted percentage (not arbitrary 75%)

- For reviews/observational studies: set calculated and actual to null, use "Not applicable" in assessment
- For RCTs: only include sample size numbers if explicitly mentioned in the methods
- Randomization: use "Not applicable" for non-randomized designs, score as 1
- Blinding: set all to false for reviews or unblinded studies
- Never fabricate numbers - if not mentioned, use null or "Not reported"
- Use empty arrays [] for missing strengths/concerns/limitations
- Base ALL content on the actual methods text provided
- DO NOT guess or infer methodology details that are not explicitly present
- DO NOT default to score 4 - use the full 1-5 range based on actual quality

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
