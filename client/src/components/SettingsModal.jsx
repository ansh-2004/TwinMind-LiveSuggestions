import { useState } from "react";

export default function SettingsModal({ apiKey, settings, defaults, onSave, onClose }) {
  const [key, setKey]   = useState(apiKey);
  const [s, setS]       = useState({ ...defaults, ...settings });
  const [showKey, setShowKey] = useState(false);

  const field    = (f) => (e) => setS((p) => ({ ...p, [f]: e.target.value }));
  const numField = (f) => (e) => setS((p) => ({ ...p, [f]: Number(e.target.value) }));
  const reset    = () => setS(defaults);

  const save = () => {
    if (!key.trim()) return alert("Please enter your Groq API key.");
    onSave(key.trim(), s);
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-title">⚙ Settings</div>

        {/* API Key */}
        <div className="modal-section">
          <label>Groq API Key *</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type={showKey ? "text" : "password"}
              className="modal-input"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="gsk_..."
              autoComplete="off"
              spellCheck={false}
            />
            <button className="btn-ghost" onClick={() => setShowKey((v) => !v)}>
              {showKey ? "Hide" : "Show"}
            </button>
          </div>
          <p className="modal-note">
            Get a free key at{" "}
            <a href="https://console.groq.com" target="_blank" rel="noopener noreferrer">
              console.groq.com
            </a>
            . Stored only in your browser's localStorage — never sent to any third party.
          </p>
        </div>

        <div className="section-divider" />

        {/* Refresh interval */}
        <div className="modal-section">
          <label>Auto-refresh interval (seconds)</label>
          <input
            type="number"
            className="modal-input"
            value={s.refreshInterval}
            min={10} max={120} step={5}
            onChange={numField("refreshInterval")}
          />
          <p className="modal-note">
            How often the transcript chunks and suggestions auto-update while recording.
          </p>
        </div>

        <div className="section-divider" />

        {/* Context windows */}
        <div className="modal-section">
          <label>Context Windows (characters of transcript to send)</label>
          <div className="settings-grid">
            <div>
              <label>Suggestions</label>
              <input type="number" className="modal-input" value={s.suggestionContextWindow}
                min={500} max={12000} step={500} onChange={numField("suggestionContextWindow")} />
            </div>
            <div>
              <label>Chat replies</label>
              <input type="number" className="modal-input" value={s.chatContextWindow}
                min={500} max={20000} step={500} onChange={numField("chatContextWindow")} />
            </div>
            <div>
              <label>Expand on click</label>
              <input type="number" className="modal-input" value={s.expandContextWindow}
                min={500} max={20000} step={500} onChange={numField("expandContextWindow")} />
            </div>
          </div>
        </div>

        <div className="section-divider" />

        {/* Custom prompts */}
        <div className="modal-section">
          <label>Live Suggestions Prompt (blank = use optimized default)</label>
          <textarea
            className="modal-textarea"
            value={s.suggestionPrompt}
            onChange={field("suggestionPrompt")}
            placeholder="Leave blank to use the built-in prompt…"
          />
        </div>
        <div className="modal-section">
          <label>Expanded Answer Prompt (on suggestion click)</label>
          <textarea
            className="modal-textarea"
            value={s.expandPrompt}
            onChange={field("expandPrompt")}
            placeholder="Leave blank to use the built-in prompt…"
          />
        </div>
        <div className="modal-section">
          <label>Chat System Prompt</label>
          <textarea
            className="modal-textarea"
            value={s.chatPrompt}
            onChange={field("chatPrompt")}
            placeholder="Leave blank to use the built-in prompt…"
          />
        </div>

        <div className="modal-footer">
          <button className="btn-ghost" onClick={reset}>Reset Defaults</button>
          {apiKey && (
            <button className="btn-ghost" onClick={onClose}>Cancel</button>
          )}
          <button className="btn-primary" onClick={save}>Save Settings</button>
        </div>
      </div>
    </div>
  );
}
