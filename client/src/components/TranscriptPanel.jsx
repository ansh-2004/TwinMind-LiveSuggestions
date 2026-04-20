import { useEffect, useRef } from "react";

function formatTime(date) {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function TranscriptPanel({
  transcript,
  isRecording,
  onStart,
  onStop,
  apiKey,
  onOpenSettings,
}) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  const handleMicClick = () => {
    if (!apiKey) return onOpenSettings();
    if (isRecording) onStop();
    else onStart();
  };

  return (
    <div className="panel">
      {/* Header */}
      <div className="panel-header">
        <span className="panel-title">Transcript</span>
        <button
          className={`mic-btn ${isRecording ? "recording" : ""}`}
          onClick={handleMicClick}
          title={isRecording ? "Stop recording" : "Start recording"}
        >
          {isRecording ? "■" : "🎙"}
        </button>
      </div>

      {/* Body */}
      <div className="panel-body">
        {transcript.length === 0 ? (
          <div className="transcript-empty">
            <div className="empty-icon">🎙</div>
            {!apiKey ? (
              <>
                <p>Enter your Groq API key in Settings to begin.</p>
                <button className="btn-ghost" onClick={onOpenSettings}>
                  ⚙ Open Settings
                </button>
              </>
            ) : (
              <p>
                Click the mic button to start recording. Transcription will appear here in
                real-time, updated every ~30 seconds.
              </p>
            )}
          </div>
        ) : (
          <>
            {transcript.map((chunk) => (
              <div key={chunk.id} className="transcript-chunk">
                <div className="transcript-chunk-time">{formatTime(chunk.ts)}</div>
                <div className="transcript-chunk-text">{chunk.text}</div>
              </div>
            ))}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Stop button at bottom when recording */}
      {isRecording && (
        <div className="transcript-footer">
          <button
            className="btn-ghost"
            onClick={onStop}
            style={{ color: "var(--red)", borderColor: "rgba(255,95,95,0.28)" }}
          >
            ■ Stop Recording
          </button>
        </div>
      )}
    </div>
  );
}
