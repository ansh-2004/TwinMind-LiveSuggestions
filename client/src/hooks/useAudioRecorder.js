import { useState, useRef, useCallback } from "react";

/**
 * Records mic audio in chunks of `chunkIntervalMs` and calls `onChunk(blob)`
 * for each chunk. Uses a stop/restart loop so each chunk is a complete file
 * that Whisper can transcribe.
 */
export function useAudioRecorder(onChunk, chunkIntervalMs = 30000) {
  const [isRecording, setIsRecording] = useState(false);

  const streamRef        = useRef(null);
  const recorderRef      = useRef(null);
  const chunkTimerRef    = useRef(null);
  const chunksRef        = useRef([]);
  const shouldContinueRef = useRef(false);

  const startNewRecorder = useCallback(
    (stream) => {
      const mimeType = getSupportedMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data?.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        // Flush this chunk
        if (chunksRef.current.length > 0) {
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
          chunksRef.current = [];
          if (blob.size > 2000) onChunk(blob); // skip silence-only tiny blobs
        }

        // Restart if still recording
        if (shouldContinueRef.current && streamRef.current) {
          startNewRecorder(streamRef.current);
        }
      };

      recorder.start();

      // Schedule stop after chunk interval
      chunkTimerRef.current = setTimeout(() => {
        if (recorder.state === "recording") recorder.stop();
      }, chunkIntervalMs);
    },
    [onChunk, chunkIntervalMs]
  );

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      shouldContinueRef.current = true;
      startNewRecorder(stream);
      setIsRecording(true);
    } catch (err) {
      console.error("Mic access error:", err);
      alert(
        "Microphone access denied. Please allow microphone permissions and reload the page."
      );
    }
  }, [startNewRecorder]);

  const stopRecording = useCallback(() => {
    shouldContinueRef.current = false;
    clearTimeout(chunkTimerRef.current);

    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }

    // Stop all tracks
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;

    setIsRecording(false);
  }, []);

  return { isRecording, startRecording, stopRecording };
}

function getSupportedMimeType() {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];
  for (const t of candidates) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return "";
}
