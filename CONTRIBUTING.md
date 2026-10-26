# Contributing to TypeByAman

Thank you for your interest in contributing to **TypeByAman**, created by [Aman Kumar](https://github.com/Amankr0075)!

TypeByAman is a **100% free, local-first utility** with zero server costs, zero subscriptions, and complete respect for privacy.

## Project Architecture

The repository contains three primary components:

1. **Root Web Studio (`index.html`, `style.css`, `app.js`)**:
   - Standalone client-side web application hosted directly on GitHub Pages.
   - Built with Vanilla HTML/CSS/JavaScript with Web Audio API for synthetic mechanical keyboard sounds.

2. **Chrome Extension (`chrome-extension/`)**:
   - Manifest V3 extension.
   - Content scripts, background worker, popup dashboard, and options page.
   - Works on any webpage with text fields, CodeMirror, Monaco, or contenteditable areas.

3. **VS Code Extension (`vscode-extension/`)**:
   - TypeScript extension using the VS Code Extensibility API.
   - Supports native character insertion, status bar indicators, speed presets, and custom webview panel.

## Development Workflow

### Web Studio
Open `index.html` in any modern web browser or use a local HTTP server:
```bash
npx serve .
```

### Chrome Extension
1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** in the top-right corner.
3. Click **Load unpacked** and select the `chrome-extension` directory.

### VS Code Extension
1. Open the `vscode-extension` directory in VS Code:
   ```bash
   cd vscode-extension
   npm install
   npm run compile
   ```
2. Press `F5` to launch an Extension Development Host window.
3. To package into `.vsix`:
   ```bash
   npm run package
   ```

## Guidelines

- All processing **must remain 100% client-side**. Do not add external server dependencies or tracking analytics.
- Code should be clean, commented, and adhere to existing formatting.
- PRs are welcome for speed options, custom sound profiles, syntax themes, and accessibility enhancements.

## License

TypeByAman is proprietary software developed by Aman Kumar. Released under a [Proprietary & Commercial Software License](LICENSE). Not open source. Unauthorized modification, copying, or redistribution is strictly prohibited.
