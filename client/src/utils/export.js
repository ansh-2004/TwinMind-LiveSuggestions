/**
 * Exports the full session (transcript + suggestions + chat) as a JSON file.
 */
export function exportSession(transcript, suggestionBatches, chatMessages) {
  const ts = (d) => (d instanceof Date ? d : new Date(d)).toISOString();

  const session = {
    exportedAt: new Date().toISOString(),
    summary: {
      transcriptChunks: transcript.length,
      suggestionBatches: suggestionBatches.length,
      totalSuggestions: suggestionBatches.reduce((a, b) => a + b.suggestions.length, 0),
      chatMessages: chatMessages.length,
    },
    transcript: transcript.map((c) => ({
      timestamp: ts(c.ts),
      text: c.text,
    })),
    suggestionBatches: suggestionBatches.map((batch) => ({
      timestamp: ts(batch.ts),
      suggestions: batch.suggestions.map((s) => ({
        type: s.type,
        preview: s.preview,
        detail: s.detail,
      })),
    })),
    chat: chatMessages.map((m) => ({
      role: m.role,
      content: m.content,
      timestamp: ts(m.ts || new Date()),
      ...(m.isSuggestion ? { fromSuggestion: m.suggestion?.preview } : {}),
    })),
  };

  const blob = new Blob([JSON.stringify(session, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `twinmind-session-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
