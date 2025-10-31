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

  // Define methodology-related keywords and phrases with weights
  const methodologyKeywords = {
    // Core methodology terms (high weight - strong indicators)
    design: {
      weight: 3,
      keywords: [
        "study design", "research design", "experimental design", "trial design",
        "methodology", "methods", "procedures", "protocol", "study protocol"
      ]
    },
    // Study type indicators (high weight)
    studyType: {
      weight: 2.5,
      keywords: [
        "randomized", "randomised", "double-blind", "single-blind", "placebo-controlled",
        "cohort", "case-control", "cross-sectional", "prospective", "retrospective",
        "systematic review", "meta-analysis", "qualitative", "quantitative",
        "open-label", "controlled trial", "observational study"
      ]
    },
    // Sample/population (medium-high weight)
    sample: {
      weight: 2,
      keywords: [
        "participants", "patients", "subjects", "sample size", "population",
        "inclusion criteria", "exclusion criteria", "recruitment", "enrollment", "enrolled",
        "eligibility", "screening", "selected", "recruited"
      ]
    },
    // Statistical methods (high weight - strong methodology indicator)
    statistics: {
      weight: 2.5,
      keywords: [
        "statistical analysis", "statistical test", "confidence interval", "p-value",
        "regression", "anova", "chi-square", "t-test", "Mann-Whitney", "Wilcoxon",
        "power analysis", "sample size calculation", "intention-to-treat", "per-protocol",
        "kaplan-meier", "cox regression", "logistic regression", "hazard ratio"
      ]
    },
    // Data collection (medium weight)
    data: {
      weight: 1.5,
      keywords: [
        "data collection", "measurement", "assessment", "outcome measure",
        "questionnaire", "interview", "survey", "follow-up", "baseline",
        "endpoints", "variables", "instruments", "scales"
      ]
    },
    // Intervention/treatment (medium weight)
    intervention: {
      weight: 1.5,
      keywords: [
        "intervention", "treatment", "therapy", "dosage", "administration",
        "control group", "treatment group", "comparison", "versus",
        "experimental group", "placebo"
      ]
    },
    // Ethical/procedural (lower weight but still important)
    ethics: {
      weight: 1,
      keywords: [
        "ethical approval", "ethics committee", "institutional review board", "IRB",
        "informed consent", "consent form", "ethics", "approved by"
      ]
    }
  };

  const normalizedText = trimmed.toLowerCase();
  
  // Count weighted matches in each category
  let weightedScore = 0;
  let totalMatches = 0;
  const categoryMatches = {};
  
  for (const [category, config] of Object.entries(methodologyKeywords)) {
    const matches = config.keywords.filter(keyword => normalizedText.includes(keyword));
    const matchCount = matches.length;
    categoryMatches[category] = matchCount;
    totalMatches += matchCount;
    
    // Add weighted score (each match in category contributes its weight)
    weightedScore += matchCount * config.weight;
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

  // Calculate confidence score (0-100) using weighted approach
  // Scoring logic:
  // - Use weighted scores to prioritize strong methodology indicators
  // - Need at least 2 matches with minimum weighted score
  // - Category diversity adds bonus
  // - Anti-patterns reduce confidence
  const categoriesWithMatches = Object.values(categoryMatches).filter(count => count > 0).length;
  
  let confidence = 0;
  
  if (totalMatches >= 2 && weightedScore >= 3) {
    // Base confidence from weighted score (max 60 points)
    // Higher weight keywords contribute more to confidence
    confidence += Math.min(weightedScore * 4, 60);
    
    // Bonus for category diversity (max 25 points)
    // Having 4+ categories is strong signal
    confidence += Math.min(categoriesWithMatches * 6, 25);
    
    // Bonus for high-value indicators (max 15 points)
    // Prioritize design, statistics, and study type matches
    const highValueMatches = categoryMatches.design + categoryMatches.statistics + categoryMatches.studyType;
    confidence += Math.min(highValueMatches * 2, 15);
  }
  
  // Penalize anti-patterns more aggressively (each reduces confidence by 25%)
  confidence *= Math.pow(0.75, antiPatternMatches);
  
  // Round to integer
  confidence = Math.round(Math.max(0, Math.min(100, confidence)));

  const CONFIDENCE_THRESHOLD = 60; // Threshold for acceptance
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
