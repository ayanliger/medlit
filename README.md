# MedLit

> **⚠️ EARLY DEVELOPMENT** - This project is in the initial implementation phase. Chrome built-in AI API integration has been corrected but the extension functionality has not been tested yet.

MedLit is a Chrome extension that will accelerate medical literature review with Chrome's on-device AI (Gemini Nano). It is aimed at clinicians, trainees, and researchers who need structured study summaries, methodology vetting, jargon simplification, and rapid translation without sending sensitive papers to external servers.

## Planned Features

- Privacy-preserving, PICO-structured study summaries
- Methodological quality assessment (Cochrane Risk of Bias framework)
- Medical jargon simplification
- Multilingual abstract translation
- Export to citation managers (JSON, BibTeX, CSV)

## Current Status

**What's Implemented:**
- ✅ Chrome built-in AI API integration (LanguageModel, Summarizer, Rewriter, Translator)
- ✅ API detection and availability checking
- ✅ Fallback strategies when APIs unavailable
- ✅ Basic extension structure (manifest, service worker, content script, side panel)
- ✅ Test page to verify API access (`test-ai-api.html`)

**What's NOT Tested:**
- ❌ Extension installation
- ❌ Side panel functionality
- ❌ Actual AI feature execution
- ❌ Document parsing
- ❌ UI rendering
- ❌ Export functionality

## Project Structure

```
medlit/
├─ manifest.json                   # Manifest V3 config (permissions corrected)
├─ test-ai-api.html                # API detection test page (verified working)
└─ src/
   ├─ background/serviceWorker.js  # Context menus, side panel, messaging
   ├─ content/contentScript.js     # Document metadata capture
   ├─ sidepanel/
   │  ├─ index.html                # Side panel UI
   │  ├─ styles.css                # Panel styling  
   │  └─ main.js                   # UI logic and AI orchestration
   └─ ai/
      ├─ aiClient.js               # API integration (recently fixed)
      └─ promptTemplates.js        # Medical-domain prompts
```

## Chrome Built-in AI APIs - Implementation Notes

### API Integration (Fixed)

The code now correctly uses Chrome's built-in AI APIs as global constructors:

```javascript
// ✅ Correct
if (typeof LanguageModel !== 'undefined') {
  const availability = await LanguageModel.availability();
  const session = await LanguageModel.create(options);
}

// ❌ Previous incorrect approach
const AI_NAMESPACE = chrome?.ai;
if (AI_NAMESPACE?.languageModel?.create) { ... }
```

### APIs Integrated

- **`LanguageModel`** - Prompt API for structured extraction (PICO framework)
- **`Summarizer`** - Summarizer API for key-points generation
- **`Rewriter`** - Rewriter API for jargon simplification
- **`Translator`** - Translator API for multilingual support

### Manifest Permissions

**No AI-specific permissions required.** The following non-existent permissions were removed:
- ~~`"aiLanguageModel"`~~
- ~~`"aiSummarizer"`~~
- ~~`"aiWriter"`~~
- ~~`"aiTranslation"`~~

## Testing API Availability

**Test Page:** `medlit/test-ai-api.html`

1. Open `test-api-api.html` in Chrome 128+
2. Click **"Test API Access"**
3. Verify all APIs show as detected:
   ```
   API Constructors:
     LanguageModel: true
     Summarizer: true
     Rewriter: true
     Translator: true
   ```
4. Check availability status (should be `downloadable` or `readily`)

**Test Result (Verified):** ✅ All APIs detected correctly

## Prerequisites (For Future Testing)

- Chrome 128+ (Dev, Canary, or Stable with flags)
- Enable flags:
  - `chrome://flags/#prompt-api-for-gemini-nano`
  - `chrome://flags/#summarization-api-for-gemini-nano`
- ~2GB free storage for Gemini Nano model

## Installation (Not Yet Tested)

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select `medlit` folder
4. Extension should appear in toolbar

## Recent Fixes

### Issue: Incorrect API Implementation

**Problem:** Code used non-existent `chrome.ai` namespace and invalid manifest permissions.

**Root Cause:** Chrome's built-in AI APIs are global constructors, not properties of `chrome.ai`.

**Solution Applied:**
1. Removed invalid manifest permissions (`aiLanguageModel`, etc.)
2. Changed API access from `chrome.ai.languageModel` → `LanguageModel`
3. Added proper availability checks before API creation
4. Fixed Translator API method from `createTranslator()` → `create()`

**Verification:** Test page confirms all APIs are now detected.

## Architecture Notes

- **Service Worker:** Context menu management, side panel coordination
- **Content Script:** Page content extraction and user selection tracking  
- **Side Panel:** Main UI (not yet tested)
- **AI Client:** API integration with fallback strategies
- **Prompt Templates:** Medical-domain prompt builders (PICO framework)

## Immediate Next Steps

1. **Install and test the extension** - Load in Chrome and verify basic functionality
2. **Test AI features** - Trigger model download and test each feature:
   - Clinical summary generation
   - Methodology scanner
   - Jargon simplifier
   - Translation
3. **Verify UI rendering** - Check that JSON responses render correctly in side panel
4. **Test document parsing** - Ensure content extraction works on various sites
5. **Debug issues** - Fix any errors discovered during testing

## Future Enhancements

- Prompt tuning for medical accuracy
- Persistent user settings
- Additional export formats (BibTeX, CSV)
- Enhanced PDF support
- Batch processing
- Result caching
