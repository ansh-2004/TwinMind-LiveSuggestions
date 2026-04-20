import { useState, useRef, useEffect, useCallback } from "react";
import { streamChat, streamExpand } from "../api/groq";

function ChatMessage({ message }) {
  const { role, content, streaming, isSuggestion } = message;
  return (
    <div className={`chat-message ${role}`}>
      <div className={`chat-bubble ${streaming ? "streaming" : ""}`}>
        {isSuggestion && role === "user" && (
          <div className="suggestion-tag">◈ from suggestion</div>
        )}
        {content || (streaming ? "" : "…")}
      </div>
    </div>
  );
}

export default function ChatPanel({ messages, setMessages, transcript, apiKey, settings }) {
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const bottomRef    = useRef(null);
  const inputRef     = useRef(null);
  const pendingExpandRef = useRef(null);

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // When a suggestion user-message is added, auto-expand it
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (
      last?.role === "user" &&
      last?.isSuggestion &&
      last?.suggestion &&
      !isStreaming &&
      pendingExpandRef.current !== last.id
    ) {
      pendingExpandRef.current = last.id;
      doExpand(last.suggestion);
    }
  });

  const appendAssistant = () => {
    const msg = { id: Date.now(), role: "assistant", content: "", streaming: true, ts: new Date() };
    setMessages((prev) => [...prev, msg]);
    return msg.id;
  };

  const appendToken = (token) => {
    setMessages((prev) => {
      const copy = [...prev];
      const last = copy[copy.length - 1];
      if (last?.role === "assistant") last.content += token;
      return copy;
    });
  };

  const finalizeAssistant = () => {
    setMessages((prev) => {
      const copy = [...prev];
      const last = copy[copy.length - 1];
      if (last?.role === "assistant") last.streaming = false;
      return copy;
    });
    setIsStreaming(false);
  };

  const handleError = (err) => {
    setMessages((prev) => {
      const copy = [...prev];
      const last = copy[copy.length - 1];
      if (last?.role === "assistant") {
        last.content = `Error: ${err.message}`;
        last.streaming = false;
      }
      return copy;
    });
    setIsStreaming(false);
  };

  const doExpand = useCallback(
    async (suggestion) => {
      if (!apiKey) return;
      setIsStreaming(true);
      appendAssistant();
      try {
        await streamExpand(
          suggestion,
          transcript,
          apiKey,
          { prompt: settings.expandPrompt, contextWindow: settings.expandContextWindow },
          appendToken,
          finalizeAssistant
        );
      } catch (err) {
        handleError(err);
      }
    },
    [apiKey, transcript, settings]
  );

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || !apiKey || isStreaming) return;

    const userMsg = { id: Date.now(), role: "user", content: text, ts: new Date() };
    setInput("");
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    setIsStreaming(true);

    const apiMessages = allMessages.map(({ role, content }) => ({ role, content }));
    appendAssistant();

    try {
      await streamChat(
        apiMessages,
        transcript,
        apiKey,
        { prompt: settings.chatPrompt, contextWindow: settings.chatContextWindow },
        appendToken,
        finalizeAssistant
      );
    } catch (err) {
      handleError(err);
    }
  }, [input, apiKey, isStreaming, messages, transcript, settings]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="panel" style={{ borderRight: "none" }}>
      <div className="panel-header">
        <span className="panel-title">Chat</span>
        {messages.length > 0 && (
          <button className="btn-ghost" onClick={() => setMessages([])} style={{ fontSize: 11 }}>
            Clear
          </button>
        )}
      </div>

      <div className="chat-body">
        {messages.length === 0 ? (
          <div className="chat-empty">
            <div className="empty-icon">💬</div>
            <p>Click a suggestion card or type below to ask anything about the conversation.</p>
          </div>
        ) : (
          <div className="chat-messages">
            {messages.map((msg) => (
              <ChatMessage key={msg.id || Math.random()} message={msg} />
            ))}
            <div ref={bottomRef} />
          </div>
        )}

        <div className="chat-footer">
          <textarea
            ref={inputRef}
            className="chat-input"
            placeholder={apiKey ? "Ask anything about this meeting…" : "Add API key in Settings first"}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={isStreaming || !apiKey}
          />
          <button
            className="chat-send-btn"
            onClick={sendMessage}
            disabled={!input.trim() || isStreaming || !apiKey}
            title="Send (Enter)"
          >
            {isStreaming ? (
              <span className="spinner" style={{ borderTopColor: "#fff", width: 12, height: 12 }} />
            ) : (
              "↑"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
