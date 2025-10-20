# MedLit

MedLit is a Chrome extension that accelerates medical literature review with Chrome's on-device AI (Gemini Nano). It is aimed at clinicians, trainees, and researchers who need structured study summaries, methodology vetting, jargon simplification, and rapid translation without sending sensitive papers to external servers.

## Project Goals

- Deliver privacy-preserving, PICO-structured study summaries in seconds.
- Surface methodological red flags via the Cochrane Risk of Bias lens.
- Simplify dense biomedical language for quick comprehension.
- Translate non-English abstracts while retaining clinical nuance.
- Export key points for systematic reviews, note-taking, and citation managers.

## Extension Layout

```
medlit/
├─ manifest.json                   # Manifest V3 configuration
└─ src/
   ├─ background/serviceWorker.js  # Context menus, side panel orchestration, tab messaging
   ├─ content/contentScript.js     # Captures document metadata and selections
   ├─ sidepanel/
   │  ├─ index.html                # Side panel shell
   │  ├─ styles.css                # Panel styling
   │  └─ main.js                   # UI logic, AI orchestration, export flow
   └─ ai/
      ├─ aiClient.js               # Chrome AI integrations + fallbacks
      └─ promptTemplates.js        # Prompt builders aligned with medical schemas
```

## Current Feature Pass

- **Structured Summary:** Retrieves article context via the content script, calls the Chrome AI language model (or deterministic fallback) for PICO-aligned JSON, and renders the results in the side panel.
- **Methodology Rigor Scanner:** Context-menu or button-triggered assessment of selected methods text, providing scored strengths/concerns using Cochrane-style categories.
- **Jargon Simplifier:** Converts highlighted passages into plain English with quick term glossaries.
- **Translation:** Attempts on-device translation to English with fallback messaging when unavailable.
- **Export Preview:** Generates a JSON export (key points, markdown summary, metadata) for downstream systematic review tooling.

All AI calls prefer Chrome's on-device `chrome.ai` APIs. When a capability is missing (e.g., running on an unsupported channel), the UI returns a clearly marked heuristic preview so users can still orient themselves.

## Getting Started

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and choose the `medlit` folder.
4. Opt into the Gemini Nano local model (available in Chrome Canary 122+) if prompted.
5. Navigate to a research article, click the MedLit action button to open the side panel, and test the context menu items on highlighted text.

## Development Notes

- Side panel and service worker communicate via `chrome.runtime.sendMessage`. All feature entry points are centralized in `src/sidepanel/main.js`.
- AI prompts mirror the MedLit draft document and produce strict JSON that the UI renders as definition lists and bullet summaries.
- When `chrome.ai` capabilities throw or are unavailable, the AI client returns structured fallbacks (`source: "fallback"`) so the UI can label results appropriately.
- Exported files are timestamped JSON documents that include the generated key points, markdown summary, and captured metadata for downstream ingestion.

## Next Up

1. Replace heuristic fallbacks with final Gemini Nano prompt tuning and guardrail handling.
2. Add persistent settings (temperature, auto-open side panel, export defaults) via `chrome.storage.sync`.
3. Wire clipboard and BibTeX/CSV exporters alongside the JSON download.
4. Enhance document parsing (PDF.js integration, section detection) to improve methodology targeting.
