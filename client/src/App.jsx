import { useState, useRef, useEffect, useCallback } from "react";
import TranscriptPanel from "./components/TranscriptPanel";
import SuggestionsPanel from "./components/SuggestionsPanel";
import ChatPanel from "./components/ChatPanel";
import SettingsModal from "./components/SettingsModal";
import { useAudioRecorder } from "./hooks/useAudioRecorder";
import { transcribeAudio, fetchSuggestions } from "./api/groq";
import { exportSession } from "./utils/export";
import "./App.css";

export const DEFAULT_SETTINGS = {
  suggestionPrompt: "",
  chatPrompt: "",
  expandPrompt: "",
  suggestionContextWindow: 3000,
  chatContextWindow: 6000,
  expandContextWindow: 6000,
  refreshInterval: 30,
};

export default function App() {
  const [apiKey, setApiKey] = useState(
    () => localStorage.getItem("groq_api_key") || ""
  );
  const [showSettings, setShowSettings] = useState(
    !localStorage.getItem("groq_api_key")
  );
  const [settings, setSettings] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("twinmind_settings"));
      return { ...DEFAULT_SETTINGS, ...saved };
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const [transcript, setTranscript] = useState([]);
  const [suggestionBatches, setSuggestionBatches] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [error, setError] = useState("");

  const transcriptRef = useRef([]);
  const autoRefreshTimer = useRef(null);
  const isLoadingRef = useRef(false);

  const fullTranscript = transcript.map((t) => t.text).join(" ");

  // ── Audio chunk handler ────────────────────────────────────────────────
  const onAudioChunk = useCallback(
    async (blob) => {
      if (!apiKey) return;
      try {
        const text = await transcribeAudio(blob, apiKey);
        if (!text?.trim()) return;
        const chunk = { id: Date.now(), text: text.trim(), ts: new Date() };
        setTranscript((prev) => {
          const updated = [...prev, chunk];
          transcriptRef.current = updated;
          return updated;
        });
      } catch (err) {
        setError(err.message);
      }
    },
    [apiKey]
  );

  const { isRecording, startRecording, stopRecording } = useAudioRecorder(
    onAudioChunk,
    settings.refreshInterval * 1000
  );

  // ── Suggestion refresh ─────────────────────────────────────────────────
  const refreshSuggestions = useCallback(async () => {
    const text = transcriptRef.current.map((t) => t.text).join(" ");
    if (!text.trim() || !apiKey || isLoadingRef.current) return;

    isLoadingRef.current = true;
    setIsLoadingSuggestions(true);
    setError("");

    try {
      const data = await fetchSuggestions(text, apiKey, {
        prompt: settings.suggestionPrompt,
        contextWindow: settings.suggestionContextWindow,
      });
      if (data.suggestions?.length) {
        setSuggestionBatches((prev) => [
          { id: Date.now(), ts: new Date(), suggestions: data.suggestions },
          ...prev,
        ]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      isLoadingRef.current = false;
      setIsLoadingSuggestions(false);
    }
  }, [apiKey, settings]);

  // ── Auto-refresh timer ─────────────────────────────────────────────────
  useEffect(() => {
    if (isRecording) {
      autoRefreshTimer.current = setInterval(
        refreshSuggestions,
        settings.refreshInterval * 1000
      );
    } else {
      clearInterval(autoRefreshTimer.current);
    }
    return () => clearInterval(autoRefreshTimer.current);
  }, [isRecording, refreshSuggestions, settings.refreshInterval]);

  // ── Settings ───────────────────────────────────────────────────────────
  const saveSettings = (newKey, newSettings) => {
    setApiKey(newKey);
    localStorage.setItem("groq_api_key", newKey);
    const merged = { ...DEFAULT_SETTINGS, ...newSettings };
    setSettings(merged);
    localStorage.setItem("twinmind_settings", JSON.stringify(merged));
    setShowSettings(false);
  };

  // ── Export ─────────────────────────────────────────────────────────────
  const handleExport = () =>
    exportSession(transcript, suggestionBatches, chatMessages);

  // ── Suggestion click → send to chat ───────────────────────────────────
  const handleSuggestionClick = (suggestion) => {
    setChatMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        role: "user",
        content: `Tell me more about: "${suggestion.preview}"`,
        isSuggestion: true,
        suggestion,
        ts: new Date(),
      },
    ]);
  };

  return (
    <div className="app">
      {/* ── Header ── */}
      <header className="app-header">
        <div className="header-left">
          <div className="logo">
            <span className="logo-icon">◈</span>
            <span className="logo-text">TwinMind</span>
          </div>
          {isRecording && (
            <div className="recording-badge">
              <span className="rec-dot" />
              LIVE
            </div>
          )}
        </div>
        <div className="header-right">
          {error && (
            <span className="error-pill" onClick={() => setError("")} title="Click to dismiss">
              ⚠ {error.slice(0, 55)}…
            </span>
          )}
          <button className="btn-ghost" onClick={handleExport} title="Export session as JSON">
            ↓ Export
          </button>
          <button className="btn-ghost" onClick={() => setShowSettings(true)}>
            ⚙ Settings
          </button>
        </div>
      </header>

      {/* ── 3-column body ── */}
      <main className="app-body">
        <TranscriptPanel
          transcript={transcript}
          isRecording={isRecording}
          onStart={startRecording}
          onStop={stopRecording}
          apiKey={apiKey}
          onOpenSettings={() => setShowSettings(true)}
        />
        <SuggestionsPanel
          batches={suggestionBatches}
          isLoading={isLoadingSuggestions}
          onRefresh={refreshSuggestions}
          onSuggestionClick={handleSuggestionClick}
        />
        <ChatPanel
          messages={chatMessages}
          setMessages={setChatMessages}
          transcript={fullTranscript}
          apiKey={apiKey}
          settings={settings}
        />
      </main>

      {/* ── Settings modal ── */}
      {showSettings && (
        <SettingsModal
          apiKey={apiKey}
          settings={settings}
          defaults={DEFAULT_SETTINGS}
          onSave={saveSettings}
          onClose={() => apiKey && setShowSettings(false)}
        />
      )}
    </div>
  );
}
