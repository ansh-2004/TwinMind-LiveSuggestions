const TYPE_ICONS = {
  QUESTION:      "💬",
  FACT_CHECK:    "🔍",
  TALKING_POINT: "💡",
  ANSWER:        "✅",
  CLARIFY:       "ℹ️",
};

const TYPE_LABELS = {
  QUESTION:      "Question to Ask",
  FACT_CHECK:    "Fact Check",
  TALKING_POINT: "Talking Point",
  ANSWER:        "Answer",
  CLARIFY:       "Clarify",
};

function formatTime(date) {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function SuggestionCard({ suggestion, onClick }) {
  const { type, preview, detail } = suggestion;
  return (
    <div
      className={`suggestion-card type-${type}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
    >
      <div className="suggestion-type-badge">
        {TYPE_ICONS[type] || "•"} {TYPE_LABELS[type] || type}
      </div>
      <div className="suggestion-preview">{preview}</div>
      {detail && <div className="suggestion-detail-preview">{detail}</div>}
    </div>
  );
}

export default function SuggestionsPanel({
  batches,
  isLoading,
  onRefresh,
  onSuggestionClick,
}) {
  return (
    <div className="panel">
      {/* Header */}
      <div className="panel-header">
        <span className="panel-title">Live Suggestions</span>
        <button className="btn-ghost" onClick={onRefresh} disabled={isLoading}>
          {isLoading ? (
            <>
              <span className="spinner" /> Thinking…
            </>
          ) : (
            "↻ Refresh"
          )}
        </button>
      </div>

      {/* Body */}
      <div className="panel-body">
        {/* Loading (first time) */}
        {isLoading && batches.length === 0 && (
          <div className="loading-row loading-center">
            <span className="spinner" />
            <span>Analyzing conversation…</span>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && batches.length === 0 && (
          <div className="suggestions-empty">
            <span className="empty-icon">◈</span>
            <p>Suggestions appear here automatically while you speak.</p>
            <p style={{ marginTop: 8, fontSize: 12 }}>
              Start recording, then click ↻ Refresh or wait for the auto-update.
            </p>
          </div>
        )}

        {/* Batches — newest first */}
        {batches.map((batch, bi) => (
          <div key={batch.id} className="suggestions-batch">
            <div className="batch-label">
              {bi === 0 ? "Latest" : formatTime(batch.ts)} —{" "}
              {batch.suggestions.length} suggestions
            </div>
            {batch.suggestions.map((s, si) => (
              <SuggestionCard
                key={si}
                suggestion={s}
                onClick={() => onSuggestionClick(s)}
              />
            ))}
          </div>
        ))}

        {/* Loading spinner while refreshing with existing batches */}
        {isLoading && batches.length > 0 && (
          <div className="loading-row">
            <span className="spinner" />
            <span>Generating new suggestions…</span>
          </div>
        )}
      </div>
    </div>
  );
}
