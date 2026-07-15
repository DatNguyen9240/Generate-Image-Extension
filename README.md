# AI Workflow Studio

A local-first Chrome Extension for organizing projects and prompts, scheduling AI generation work, tracking downloads and history, and automating supported AI websites through isolated adapters.

## Development

```bash
npm install
npm run typecheck
npm test
npm run lint
npm run build
```

Load the generated `dist` directory from `chrome://extensions` using **Load unpacked**. Enable Developer mode first.

## Runtime architecture

- `src/background`: Manifest V3 service worker, typed message router, queue scheduling, downloads, notifications, tabs, and alarms.
- `src/content`: page-side automation entry point with DOM observation and adapter dispatch.
- `src/adapters`: generic `BrowserAutomationAdapter` contract plus Grok, ChatGPT, Gemini, and Claude configurations.
- `src/storage` and `src/repositories`: Dexie database and repository abstraction for all persistent records.
- `src/queue`: prioritized execution engine with retry, pause, resume, cancel, history, and structured logging.
- `src/app`, `src/pages`, and `src/components`: React desktop UI, navigation, command palette, design system, and feature pages.

Workspace data is stored in IndexedDB. Backups can be imported or exported from Settings.
