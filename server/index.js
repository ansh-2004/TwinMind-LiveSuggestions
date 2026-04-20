const express  = require("express");
const cors     = require("cors");
const multer   = require("multer");
const axios    = require("axios");
const FormData = require("form-data");

const app    = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// ── Helpers ──────────────────────────────────────────────────────────────────

function requireKey(req, res) {
  const key = req.headers["x-groq-api-key"];
  if (!key) { res.status(400).json({ error: "Missing x-groq-api-key header" }); return null; }
  return key;
}

function groqHeaders(apiKey, extra = {}) {
  return { Authorization: `Bearer ${apiKey}`, ...extra };
}

function groqError(err) {
  return err.response?.data?.error?.message || err.message || "Unknown error";
}

// ── POST /api/transcribe ──────────────────────────────────────────────────────
// Accepts multipart/form-data with field "audio". Returns { text }.
app.post("/api/transcribe", upload.single("audio"), async (req, res) => {
  const apiKey = requireKey(req, res);
  if (!apiKey) return;
  if (!req.file) return res.status(400).json({ error: "No audio file provided" });

  try {
    const form = new FormData();
    form.append("file", req.file.buffer, {
      filename: "audio.webm",
      contentType: req.file.mimetype || "audio/webm",
    });
    form.append("model", "whisper-large-v3");
    form.append("response_format", "json");
    form.append("language", "en");

    const { data } = await axios.post(
      "https://api.groq.com/openai/v1/audio/transcriptions",
      form,
      { headers: groqHeaders(apiKey, form.getHeaders()), timeout: 30000 }
    );

    res.json({ text: data.text || "" });
  } catch (err) {
    res.status(500).json({ error: groqError(err) });
  }
});

// ── POST /api/suggestions ─────────────────────────────────────────────────────
// Body: { transcript, prompt?, contextWindow? }
// Returns: { suggestions: [{ type, preview, detail }] }
app.post("/api/suggestions", async (req, res) => {
  const apiKey = requireKey(req, res);
  if (!apiKey) return;

  const { transcript, prompt, contextWindow = 3000 } = req.body;
  if (!transcript?.trim()) return res.status(400).json({ error: "No transcript provided" });

  const recentText = transcript.slice(-contextWindow);

  const systemPrompt = prompt || `You are an expert AI meeting copilot. You analyze live conversation transcripts and surface exactly 3 high-value, context-aware suggestions for the person currently in the meeting.

Each suggestion must:
- React to what is ACTUALLY being discussed right now — not generic advice
- Have a SHORT PREVIEW (max 15 words) that is useful and actionable on its own
- Have a DETAIL field (2–5 sentences) that provides deeper value when expanded

Pick the best TYPE for each suggestion based on what the conversation needs most:
- QUESTION      → A smart follow-up question the user should ask right now
- FACT_CHECK    → Verify or add context to a specific claim just made  
- TALKING_POINT → A relevant angle, insight, or data point to bring up
- ANSWER        → Direct answer to a question that was just raised in the conversation
- CLARIFY       → Background context or disambiguation for something mentioned

Rules:
- Read carefully. Be specific. Reference exact topics/names/claims from the transcript.
- Mix types intelligently — pick whatever serves the moment best.
- Previews must stand alone as useful insights (never "Click for more info").
- Never generate vague or generic suggestions.

Respond ONLY with valid JSON — no extra text, no markdown:
{
  "suggestions": [
    { "type": "QUESTION",      "preview": "...", "detail": "..." },
    { "type": "FACT_CHECK",    "preview": "...", "detail": "..." },
    { "type": "TALKING_POINT", "preview": "...", "detail": "..." }
  ]
}`;

  try {
    const { data } = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "meta-llama/llama-4-maverick-17b-128e-instruct",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user",   content: `Recent conversation transcript:\n\n${recentText}\n\nGenerate 3 suggestions now.` },
        ],
        temperature: 0.72,
        max_tokens: 900,
        response_format: { type: "json_object" },
      },
      { headers: groqHeaders(apiKey, { "Content-Type": "application/json" }), timeout: 20000 }
    );

    const parsed = JSON.parse(data.choices[0].message.content);
    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: groqError(err) });
  }
});

// ── POST /api/chat ────────────────────────────────────────────────────────────
// Body: { messages, transcript, prompt?, contextWindow? }
// Streams SSE: data: {"token":"..."} ... data: [DONE]
app.post("/api/chat", async (req, res) => {
  const apiKey = requireKey(req, res);
  if (!apiKey) return;

  const { messages, transcript, prompt, contextWindow = 6000 } = req.body;
  if (!messages?.length) return res.status(400).json({ error: "No messages provided" });

  const recentTranscript = (transcript || "").slice(-contextWindow);

  const systemPrompt = prompt || `You are an expert AI meeting copilot assistant with full context of the ongoing meeting.

Your role:
- Answer questions about the meeting thoroughly and accurately
- Reference specific things said in the transcript when relevant
- Provide expert background knowledge, context, and actionable advice
- Be direct and well-structured — use paragraphs; use bullet points only for true lists

Current meeting transcript:
---
${recentTranscript || "(Recording not started yet — answer based on general knowledge)"}
---`;

  await streamCompletion(res, apiKey, systemPrompt, messages);
});

// ── POST /api/expand ──────────────────────────────────────────────────────────
// Body: { suggestion, transcript, prompt?, contextWindow? }
// Streams SSE expanded detail for a clicked suggestion card.
app.post("/api/expand", async (req, res) => {
  const apiKey = requireKey(req, res);
  if (!apiKey) return;

  const { suggestion, transcript, prompt, contextWindow = 6000 } = req.body;
  if (!suggestion) return res.status(400).json({ error: "No suggestion provided" });

  const recentTranscript = (transcript || "").slice(-contextWindow);

  const systemPrompt = prompt || `You are an expert AI meeting copilot. When the user taps a suggestion, you give a rich, detailed, and grounded response.

Your response should:
- Directly address the suggestion topic with depth and expertise
- Reference specific things from the transcript when relevant
- Include useful background, examples, data, or reasoning
- End with 1–2 concrete next steps or follow-up thoughts
- Be structured in clear paragraphs (3–6 total)

Current meeting transcript:
---
${recentTranscript || "(No transcript yet)"}
---`;

  const userMessage = {
    role: "user",
    content: `Suggestion: "${suggestion.preview}"\nType: ${suggestion.type}\nInitial detail: ${suggestion.detail}\n\nPlease expand this into a comprehensive, detailed response.`,
  };

  await streamCompletion(res, apiKey, systemPrompt, [userMessage]);
});

// ── Shared SSE streaming helper ───────────────────────────────────────────────
async function streamCompletion(res, apiKey, systemPrompt, messages) {
  res.setHeader("Content-Type",  "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection",    "keep-alive");

  try {
    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "meta-llama/llama-4-maverick-17b-128e-instruct",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        temperature: 0.5,
        max_tokens: 1200,
        stream: true,
      },
      {
        headers: groqHeaders(apiKey, { "Content-Type": "application/json" }),
        responseType: "stream",
        timeout: 30000,
      }
    );

    let buffer = "";

    response.data.on("data", (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop(); // keep incomplete line

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;
        const payload = trimmed.slice(6);
        if (payload === "[DONE]") { res.write("data: [DONE]\n\n"); return; }
        try {
          const parsed = JSON.parse(payload);
          const token  = parsed.choices?.[0]?.delta?.content || "";
          if (token) res.write(`data: ${JSON.stringify({ token })}\n\n`);
        } catch { /* skip malformed */ }
      }
    });

    response.data.on("end",   () => { res.write("data: [DONE]\n\n"); res.end(); });
    response.data.on("error", () => res.end());
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: groqError(err) });
    } else {
      res.end();
    }
  }
}

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`TwinMind server running on http://localhost:${PORT}`);
});
