# TwinMind — AI Meeting Copilot

An always-on AI meeting copilot with live transcription, context-aware suggestions, and streaming chat. Built with React + Express + Groq.

## Features

- 🎙 **Live transcription** — Whisper Large V3 via Groq, chunked every ~30s
- ◈ **Live suggestions** — 3 context-aware cards per refresh (QUESTION / FACT_CHECK / TALKING_POINT / ANSWER / CLARIFY)
- 💬 **Streaming chat** — Click any suggestion or type freely; SSE-streamed responses
- ↓ **Export** — Full session JSON (transcript + all suggestion batches + chat history)
- ⚙ **Settings** — Edit prompts, context windows, refresh interval live

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19, Vite, vanilla CSS |
| Backend | Express 4, multer, axios |
| Transcription | Groq Whisper Large V3 |
| Suggestions / Chat | Groq `meta-llama/llama-4-maverick-17b-128e-instruct` |
| Audio capture | Browser MediaRecorder API |

## Quick Start

### Prerequisites
- Node.js 18+
- A free [Groq API key](https://console.groq.com)

### Install & run

```bash
git clone <your-repo>
cd twinmind

# Install all dependencies
npm run install:all

# Install root dev deps (concurrently)
npm install

# Start both server and client
npm run dev
```

Then open **http://localhost:5173**, paste your Groq API key in Settings, and click the mic.

### Running separately

```bash
# Terminal 1 — API server (port 3001)
cd server && node index.js

# Terminal 2 — React dev server (port 5173, proxies /api → 3001)
cd client && npm run dev
```

## Deployment

### Server → Railway / Render / Fly.io

1. Push to GitHub
2. Connect repo to Railway (or Render)
3. Set root directory to `server/`
4. Start command: `node index.js`
5. Note the public URL (e.g. `https://twinmind-server.railway.app`)

### Client → Vercel / Netlify

1. Set root directory to `client/`
2. Build command: `npm run build`
3. Output directory: `dist`
4. Add environment variable: `VITE_API_URL=https://your-server.railway.app`

> In local dev the Vite proxy handles `/api` → `localhost:3001` automatically, so `VITE_API_URL` is not needed locally.

## Project Structure

```
twinmind/
├── package.json              ← root scripts (concurrently)
├── server/
│   ├── index.js              ← Express: /api/transcribe, /api/suggestions, /api/chat, /api/expand
│   └── package.json
└── client/
    ├── vite.config.js        ← proxy /api → :3001 in dev
    ├── index.html
    └── src/
        ├── App.jsx           ← layout, state, auto-refresh timer
        ├── App.css           ← full dark theme design system
        ├── main.jsx
        ├── api/
        │   └── groq.js       ← fetch wrappers + SSE stream consumer
        ├── hooks/
        │   └── useAudioRecorder.js  ← MediaRecorder chunk loop
        ├── utils/
        │   └── export.js     ← JSON session export
        └── components/
            ├── TranscriptPanel.jsx   ← left column
            ├── SuggestionsPanel.jsx  ← middle column
            ├── ChatPanel.jsx         ← right column, streaming
            └── SettingsModal.jsx     ← API key + prompt editor
```

## Prompt Strategy

### Suggestions prompt
The system prompt instructs the model to produce exactly 3 JSON suggestions, each with a `type`, `preview` (≤15 words, standalone useful), and `detail`. The 5 types (QUESTION, FACT_CHECK, TALKING_POINT, ANSWER, CLARIFY) are described with examples so the model picks the best mix for the current moment. Temperature 0.72 keeps outputs varied without being random.

### Context window
Suggestions use the last **3,000 characters** of transcript (configurable) — enough for ~3 minutes of speech. Chat and expand use **6,000 characters**. Sending the whole transcript would bloat latency; sending too little loses context. These defaults were tuned empirically.

### Streaming
Chat and expand use SSE streaming via Groq's OpenAI-compatible `/v1/chat/completions` endpoint with `stream: true`. The server pipes raw SSE chunks to the client, which renders tokens as they arrive for <200ms perceived first-token latency.

## Tradeoffs

- **No auth / persistence** — API key lives in localStorage; session data lives in React state. Reload = fresh session. Sufficient for the assignment scope.
- **Single model for everything** — `llama-4-maverick-17b-128e-instruct` is used for both suggestions and chat per the spec.
- **MediaRecorder chunk loop** — Recording stops/restarts every N seconds instead of using `timeslice`. This produces complete audio blobs that Whisper handles correctly, at the cost of a ~200ms gap per chunk.
- **No WebSocket** — SSE is simpler and sufficient for one-way streaming; no need for bidirectional comms.
