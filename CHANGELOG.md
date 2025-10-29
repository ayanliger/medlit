# Changelog

All notable changes to MedLit will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.1] - 2025-01-29

### Changed
- **[BREAKING INTERNAL]** Updated `createLanguageModelSession` to use official `initialPrompts` parameter instead of undocumented `systemPrompt`
- **[API]** All session creation now uses documented parameter format: `initialPrompts: [{ role: "system", content: "..." }]`
- **[DOCS]** Enhanced JSDoc documentation for `createLanguageModelSession` with complete parameter descriptions
- **[DOCS]** Added inline comments explaining Rewriter API fallback strategy

### Added
- **[FEATURE]** Download progress monitoring support via optional `onProgress` callback parameter
- **[API]** Session creation now supports `monitor` callback for tracking model downloads
- **[DOCS]** Comprehensive documentation of API changes in README.md
- **[DOCS]** Created RECOMMENDATIONS.md with detailed API best practices review

### Fixed
- **[COMPLIANCE]** Aligned all Chrome Built-in AI API calls with official documentation
- **[API]** Removed use of undocumented `systemPrompt` parameter across all 6 AI functions

### Technical Details
Updated functions:
- `generateStructuredSummary()` - Line 39-44
- `evaluateMethodology()` - Line 126-131
- `simplifyMedicalText()` - Line 217-222
- `translateToEnglish()` - Line 296-301
- `buildKeyPointsExport()` - Line 349-354
- `detectStudyType()` - Line 387-392
- `createLanguageModelSession()` - Line 581-620 (signature and implementation)

### Migration Guide
**For Internal Development:**

Previous pattern:
```javascript
const session = await createLanguageModelSession({
  systemPrompt: "You are a helpful assistant.",
  temperature: 0.3,
  topK: 10
}, "en");
```

New pattern:
```javascript
const session = await createLanguageModelSession({
  initialPrompts: [
    { role: "system", content: "You are a helpful assistant." }
  ],
  temperature: 0.3,
  topK: 10
}, "en", (progress) => {
  console.log(`Model download: ${progress.percentage}%`);
});
```

**Note:** This is an internal API change. External users (end users of the extension) are not affected.

---

## [0.2.0] - 2025-01-20

### Added
- Initial functional alpha release
- PICO-structured clinical summary generation
- Methodology rigor assessment (Cochrane Risk of Bias framework)
- Medical jargon simplification
- Multilingual abstract translation
- Side panel UI and rendering
- Context menu integration
- Fallback strategies when AI unavailable

### Changed
- Refactored architecture with modular separation of concerns
- Reduced main.js from 816 to 365 lines (55% reduction)
- Extracted rendering logic into separate module
- Created shared constants and utilities

### Fixed
- Corrected Chrome built-in AI API integration
- Removed invalid manifest permissions
- Fixed API access patterns (global constructors)
- Fixed Translator API method signatures

---

## References
- Chrome Built-in AI Documentation: https://developer.chrome.com/docs/ai/
- Context7 API Documentation Review: RECOMMENDATIONS.md
