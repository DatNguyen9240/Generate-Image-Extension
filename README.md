# Generate Image Extension

Google Flow (`labs.google/fx/tools/flow`) is supported as a generation target.
Import a prompt list, select the prompts, choose Google Flow, and start
generation. Jobs are sent one at a time to the signed-in Flow tab.

Chrome MV3 extension for a simple project-based generation flow:

`Project → import prompts → edit if needed → select → generate sequentially → regenerate`

## Development

```bash
npm install
npm run typecheck
npm test
npm run lint
npm run build
```

Load the generated `dist` directory from `chrome://extensions` with **Developer mode** enabled.

## Use

1. Open the extension and create a project.
2. Import a `.txt`, `.csv`, or `.json` prompt file.
3. Edit any imported prompt directly in the project when needed.
4. Select one or more prompts and choose Grok, ChatGPT, Gemini, Claude, or Google Flow.
5. Start generation. Jobs run one at a time in Queue; completed or failed jobs can be regenerated.

Prompts are sent exactly as written. There is no mock seed data and no variable form to fill.
