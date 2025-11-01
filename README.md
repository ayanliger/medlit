# MedLit

MedLit is a Google Chrome Extension developed for accelerated medical literature review using Chrome's built-in AI capabilities. It is able to extract structured study summaries, assess methodology quality, simplify medical technical language, translate medical texts and provide a chat interface with Google's Gemini Nano LLM, all available on-device with proper offline support and privacy preservation.
  
**APIs Used:** Prompt API, Rewriter API, Translator API
**Model:** Gemini Nano (on-device)
**Developed for:** [Google Chrome Built-in AI Challenge 2025](https://devpost.com/software/medlit)

---

## Problem Solved

Medical professionals, trainees and researchers spend hours manually extracting study design elements from research papers and assessing study quality. Existing AI solutions require online navigation to chatbot interfaces and the upload of potentially sensitive medical documents to cloud services. MedLit addresses this through a browser-native, framework-aware, privacy-preserving on-device assistant using Chrome's built-in AI for analysis of medical literature, enabling rapid, structured literature review directly within the browser with offline capabilities.

## How It Works

MedLit combines three Chrome Built-in AI APIs:

1. **Prompt API** - Structured extraction with framework-specific prompts (CONSORT, PRISMA, STROBE, STARD, CARE, COREQ)
2. **Rewriter API** - Technical language simplification with medical domain-specific context
3. **Translator API** - Multilingual abstract translation with fallback to Prompt API

The extension automatically detects study types (RCT, Cohort, Systematic Review, etc.) and applies appropriate reporting framework templates to ensure element extraction accuracy.

## Core Features

### 1. Structured Summary Extraction
- Automatic study type classification (12 types supported)
- Framework-aligned extraction (CONSORT for RCTs, PRISMA for reviews etc.)
- PICO element extraction with demographics, interventions, outcomes
- Available through a side panel button or through a right-click context menu: "MedLit" --> "Summarize from selection"

### 2. Methodology Quality Assessment
- Pre-validation of methodology content (confidence threshold: 60%)
- Cochrane Risk of Bias framework scoring (1-5 scale across 5 dimensions)
- Overall quality score (0-100) with confidence-based adjustment
- Anti-pattern detection to prevent garbage-in-garbage-out
- Available through a right-click context menu: "MedLit" --> "Assess methodology from selection"

### 3. Technical Language Simplification
- Rewriter API with medical domain context
- Fallback to Prompt API with structured JSON output
- Key term extraction with definitions
- Three levels for tone and length rewriting.
  - Tone: More Casual / Neutral / More Formal
  - Length: More Concise / As-Is / More Detailed 
- Available through a right-click context menu: "MedLit" --> "Simplify language from selection"

### 4. Multilingual Translation
- Translator API for supported language pairs
- Automatic fallback to Prompt API
- Preserves medical terminology accuracy
- Available through a right-click context menu: "MedLit" --> "Translate selection to English"

### 5. Conversational Chat
- Context-aware Q&A based on side panel automatic summary or selected text ("MedLit" --> "Chat with selection")
- Token limit management with user warnings
- Markdown-rendered responses
- Chat history (last 3 Q&A pairs)
  
### 6. On-Device Privacy & Offline Support
- All processing done locally using Gemini Nano
- No data leaves the browser
- Initial model download with progress monitoring

### 7. User Experience Enhancements
- Context menu integration for easy access and text selection flexibility
- Progress indicators during AI processing
- Smart field filtering to reduce irrelevant content
- Graceful error handling with fallbacks
- Clean, intuitive side panel UI

### 8. User Customization and Accessibility
- Side panel settings for interface theme (light/dark/high contrast)
- Adjustable font settings: Sans Serif, Serif, Dyslexic-friendly
- Character size and distance sliders for dyslexia support
  
### 9. Export Functionality
- Able to export summaries, assessments, simplified text, translations, and chat logs as Markdown or json files
- Future support planned for PDF and CSV exports

## Technical Implementation

### Chrome AI API Compliance

**Prompt API** (LanguageModel):
```javascript
const session = await LanguageModel.create({
  initialPrompts: [
    { role: "system", content: "You are a medical research analyst..." }
  ],
  temperature: 0.3,
  topK: 10,
  expectedInputs: [{ type: "text", languages: ["en"] }],
  expectedOutputs: [{ type: "text", languages: ["en"] }],
  monitor(m) {
    m.addEventListener('downloadprogress', (e) => {
      console.log(`Downloaded ${e.loaded * 100}%`);
    });
  }
});
```

**Rewriter API**:
```javascript
const rewriter = await Rewriter.create({
  tone: "more-casual",
  format: "plain-text",
  length: "as-is",
  sharedContext: "Simplify medical terminology..."
});
```

**Translator API**:
```javascript
const translator = await Translator.create({
  sourceLanguage: 'es',
  targetLanguage: 'en'
});
```

### Architecture

```
medlit/
├── manifest.json                 # Manifest V3
├── src/
│   ├── ai/
│   │   ├── aiClient.js          # API integration (720 lines)
│   │   ├── promptTemplates.js   # Framework-specific prompts (665 lines)
│   │   ├── validators.js        # Content validation (164 lines)
│   │   └── fallbacks.js         # Error handling (91 lines)
│   ├── background/
│   │   └── serviceWorker.js     # Context menus & messaging
│   ├── content/
│   │   └── contentScript.js     # Content extraction
│   ├── sidepanel/
│   │   ├── index.html           # UI
│   │   ├── main.js              # App logic (1050 lines)
│   │   ├── render.js            # UI rendering
│   │   ├── styles.css           # Styling (834 lines)
│   │   └── lib/
│   │       └── marked.min.js    # Markdown rendering (v15.0.12, MIT)
│   └── shared/
│       ├── constants.js         # Shared constants
│       └── messaging.js         # Chrome messaging utilities
```

**Total codebase:** ~3,200 lines of JavaScript (excluding marked.js)

### Key Design Decisions

1. **Framework-Aware Classification**: Study type detection uses a decision tree with anti-hallucination rules to prevent misclassification (e.g., RCT vs Systematic Review)

2. **Confidence-Based Validation**: Methodology assessment validates content before scoring, adjusting scores based on confidence levels to prevent inflated ratings

3. **Multi-API Strategy**: Rewriter and Translator APIs are primary, with Prompt API fallbacks for broader compatibility

4. **On-Device Privacy**: All processing happens locally using Gemini Nano—no data leaves the browser

5. **Error Resilience**: Comprehensive fallback strategies ensure graceful degradation when AI is unavailable

## Installation

### Prerequisites
- **Chrome 138+** (Stable/Dev/Canary) — Required for Prompt API in Extensions
- **Operating system:** Windows 10/11, macOS 13+ (Ventura+), Linux, or ChromeOS on Chromebook Plus
- **Storage:** At least **22 GB** of free space on the volume containing your Chrome profile  
  *(Note: Actual Gemini Nano model is smaller; check `chrome://on-device-internals` for exact size. If free space falls below 10 GB after download, the model is automatically removed.)*
- **Hardware** (one of the following):
  - **GPU:** Strictly more than 4 GB VRAM, *OR*
  - **CPU:** 16 GB RAM or more + 4 CPU cores or more
- **Network:** Unmetered connection (Wi-Fi/ethernet recommended) for initial model download
- **Chrome flags enabled:**
  - `chrome://flags/#optimization-guide-on-device-model` → **Enabled**
  - `chrome://flags/#prompt-api-for-gemini-nano` → **Enabled**
  - `chrome://flags/#rewriter-api` → **Enabled** (Origin trial)
  - `chrome://flags/#translation-api` → **Enabled**

### Steps
1. Download/clone the repository
2. Open `chrome://extensions`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the `medlit` folder
6. Click the MedLit icon on any medical research paper

## Usage

1. Navigate to a medical research paper (PubMed, PMC, journal website)
2. Click the MedLit icon or use context menu options
3. **For full-page summary:** Click "Generate Study Summary"
4. **For methodology assessment:** Highlight Methods section → Right-click → "Assess methodology from selection"
5. **For jargon simplification:** Highlight text → Right-click → "Simplify language from selection"
6. **For translation:** Highlight non-English text → Right-click → "Translate selection to English"
7. **For chat:** After generating a summary, ask questions in the Chat tab

## Limitations & Considerations

- **PDF Extraction**: Chrome's PDF viewer has limited text extraction. For best results on PDFs, use context menu on selected text rather than full-page mode.
- **Token Limits**: Chat contexts >4000 characters receive warnings; recommended limit is 2000 characters.
- **Model Download**: First use requires downloading Gemini Nano (22 GB minimum free space needed; actual model size is smaller). Progress monitoring implemented. Chrome automatically removes the model if free space drops below 10 GB.
- **Classification Accuracy**: Study type detection uses heuristics; anti-hallucination rules mitigate but don't eliminate errors.
- **No External APIs**: Extension is intentionally built using only Chrome's built-in AI APIs—no external dependencies.

## License & Attribution

**MedLit**: MIT License (see LICENSE file)

**Third-Party Libraries**:
- **marked.js** v15.0.12 - MIT License - Markdown rendering in chat interface
  - Repository: https://github.com/markedjs/marked
  - Copyright (c) 2011-2025, Christopher Jeffrey
  - Bundled locally for offline support and Chrome Web Store compliance

## Development

**Built with**:
- ES6 Modules
- Manifest V3
- Chrome Built-in AI APIs exclusively
- No build process required

## Acknowledgements
- Chrome Built-in AI team for API access and support
- Open-source community for inspiration and libraries
- Medical professionals for feedback on usability and features
- Devpost for hosting the Google Chrome Built-in AI Challenge 2025