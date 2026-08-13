# CLOSIQ

AI-powered personal wardrobe and styling application. See `CLAUDE.md` for product/architecture context and `STATE.md` for current implementation status.

## Setup

```bash
npm install

# Optional — enables real Gemini AI. Without this, CLOSIQ runs in demo mode.
cp .env.example .env
# then edit .env and set GEMINI_API_KEY=...
```

## Development

```bash
npm run dev
```

Runs the Vite dev server with `/api/ai/*` served by its built-in middleware (`vite.config.js` → `server/apiRouter.js` → `server/geminiServer.js`).

## Production

```bash
npm run build
npm run start
```

`npm run start` runs a small Node `http` server (`server/index.js`, no framework) that serves the built `dist/` frontend and exposes the same `/api/ai/*` endpoints — this is what makes real Gemini work outside of Vite's dev-only middleware. Reads `PORT` (default `3000`) and `GEMINI_API_KEY` from `.env` if present.

---

# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
