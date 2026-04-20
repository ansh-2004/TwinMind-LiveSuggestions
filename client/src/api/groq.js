// Uses Vite proxy in dev (empty BASE), or VITE_API_URL in production
const BASE = import.meta.env.VITE_API_URL || "https://twinmind-livesuggestions.onrender.com";

export async function transcribeAudio(blob, apiKey) {
  const form = new FormData();
  form.append("audio", blob, "audio.webm");

  const res = await fetch(`${BASE}/api/transcribe`, {
    method: "POST",
    headers: { "x-groq-api-key": apiKey },
    body: form,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Transcription failed");
  return data.text;
}

export async function fetchSuggestions(transcript, apiKey, { prompt, contextWindow } = {}) {
  const res = await fetch(`${BASE}/api/suggestions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-groq-api-key": apiKey,
    },
    body: JSON.stringify({ transcript, prompt, contextWindow }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Suggestions failed");
  return data;
}

export async function streamChat(
  messages,
  transcript,
  apiKey,
  { prompt, contextWindow } = {},
  onToken,
  onDone
) {
  const res = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-groq-api-key": apiKey,
    },
    body: JSON.stringify({ messages, transcript, prompt, contextWindow }),
  });

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Chat failed");
  }

  await consumeStream(res, onToken, onDone);
}

export async function streamExpand(
  suggestion,
  transcript,
  apiKey,
  { prompt, contextWindow } = {},
  onToken,
  onDone
) {
  const res = await fetch(`${BASE}/api/expand`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-groq-api-key": apiKey,
    },
    body: JSON.stringify({ suggestion, transcript, prompt, contextWindow }),
  });

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Expand failed");
  }

  await consumeStream(res, onToken, onDone);
}

async function consumeStream(res, onToken, onDone) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop(); // keep incomplete line

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") {
        onDone?.();
        return;
      }
      try {
        const parsed = JSON.parse(data);
        if (parsed.token) onToken(parsed.token);
      } catch {
        // skip malformed lines
      }
    }
  }
  onDone?.();
}
