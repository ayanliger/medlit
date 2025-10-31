/**
 * Validates whether provided text appears to be a methodology/methods section
 * @param {string} text - The text to validate
 * @returns {Object} Validation result with isValid flag and confidence score
 */
export function validateMethodologyText(text) {
  const trimmed = (text ?? "").trim();
  
  if (!trimmed || trimmed.length < 100) {
    return {
      isValid: false,
      confidence: 0,
      reason: "Text is too short to be a meaningful methodology section (minimum 100 characters)."
    };
  }

  // Define methodology-related keywords and phrases
  const methodologyKeywords = {
    // Core methodology terms
    design: [
      "study design", "research design", "experimental design", "trial design",
      "methodology", "methods", "procedures", "protocol"
    ],
    // Study type indicators
    studyType: [
      "randomized", "randomised", "double-blind", "single-blind", "placebo-controlled",
      "cohort", "case-control", "cross-sectional", "prospective", "retrospective",
      "systematic review", "meta-analysis", "qualitative", "quantitative"
    ],
    // Sample/population
    sample: [
      "participants", "patients", "subjects", "sample size", "population",
      "inclusion criteria", "exclusion criteria", "recruitment", "enrollment", "enrolled"
    ],
    // Statistical methods
    statistics: [
      "statistical analysis", "statistical test", "confidence interval", "p-value",
      "regression", "anova", "chi-square", "t-test", "Mann-Whitney", "Wilcoxon",
      "power analysis", "sample size calculation", "intention-to-treat", "per-protocol"
    ],
    // Data collection
    data: [
      "data collection", "measurement", "assessment", "outcome measure",
      "questionnaire", "interview", "survey", "follow-up", "baseline"
    ],
    // Intervention/treatment
    intervention: [
      "intervention", "treatment", "therapy", "dosage", "administration",
      "control group", "treatment group", "comparison", "versus"
    ],
    // Ethical/procedural
    ethics: [
      "ethical approval", "ethics committee", "institutional review board", "IRB",
      "informed consent", "consent form", "ethics"
    ]
  };

  const normalizedText = trimmed.toLowerCase();
  
  // Count matches in each category
  let totalMatches = 0;
  const categoryMatches = {};
  
  for (const [category, keywords] of Object.entries(methodologyKeywords)) {
    const matches = keywords.filter(keyword => normalizedText.includes(keyword));
    categoryMatches[category] = matches.length;
    totalMatches += matches.length;
  }

  // Check for anti-patterns (text that definitely isn't methodology)
  const antiPatterns = [
    "introduction", "background", "literature review",
    "in conclusion", "to conclude", "in summary",
    "discussion", "limitations", "future research",
    "results showed", "we found that", "our findings",
    "figure 1", "figure 2", "table 1", "table 2"
  ];
  
  const antiPatternMatches = antiPatterns.filter(pattern => 
    normalizedText.includes(pattern)
  ).length;

  // Calculate confidence score (0-100)
  // Scoring logic:
  // - Need at least 3 total matches across categories
  // - Having matches in multiple categories is better
  // - Anti-patterns reduce confidence significantly
  const categoriesWithMatches = Object.values(categoryMatches).filter(count => count > 0).length;
  
  let confidence = 0;
  
  if (totalMatches >= 3) {
    // Base confidence from total matches (max 50 points)
    confidence += Math.min(totalMatches * 5, 50);
    
    // Bonus for category diversity (max 30 points)
    confidence += Math.min(categoriesWithMatches * 5, 30);
    
    // Bonus for strong statistical/design indicators (max 20 points)
    const strongIndicators = categoryMatches.design + categoryMatches.statistics + categoryMatches.studyType;
    confidence += Math.min(strongIndicators * 3, 20);
  }
  
  // Penalize anti-patterns (each reduces confidence by 20%)
  confidence *= Math.pow(0.8, antiPatternMatches);
  
  // Round to integer
  confidence = Math.round(Math.max(0, Math.min(100, confidence)));

  const CONFIDENCE_THRESHOLD = 50; // Threshold for acceptance
  const isValid = confidence >= CONFIDENCE_THRESHOLD;
  
  return {
    isValid,
    confidence,
    threshold: CONFIDENCE_THRESHOLD,
    reason: isValid 
      ? `Text appears to contain methodology content (${totalMatches} methodology indicators found across ${categoriesWithMatches} categories).`
      : antiPatternMatches > 0
        ? `Text appears to be from a different section (${antiPatternMatches} non-methodology indicators detected).`
        : `Text lacks sufficient methodology indicators (found ${totalMatches}, need at least 3 with good distribution).`,
    details: {
      totalMatches,
      categoriesWithMatches,
      antiPatternMatches,
      categoryBreakdown: categoryMatches
    }
  };
}
