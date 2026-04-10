"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  GoogleGenAI,
  Modality,
  type LiveServerMessage,
  type Session,
} from "@google/genai"
import type { LiveTokenResponse, TranscriptTurn, VoiceModel } from "./use-interview"

// ---------------------------------------------------------------------------
// Audio constants — Gemini Live expects 16kHz mono PCM in, emits 24kHz PCM out.
// ---------------------------------------------------------------------------
const INPUT_SAMPLE_RATE = 16_000
const OUTPUT_SAMPLE_RATE = 24_000
const WORKLET_NAME = "live-pcm-capture"

// AudioWorklet that emits raw Float32 mono frames back to the main thread.
// Loaded via a Blob URL so we don't need a separate /public asset.
const PCM_WORKLET_SRC = `
class PCMCapture extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0]?.[0];
    if (ch && ch.length) {
      // Copy — the underlying buffer is reused between process() calls.
      this.port.postMessage(ch.slice(0));
    }
    return true;
  }
}
registerProcessor('${WORKLET_NAME}', PCMCapture);
`

function floatTo16BitPCM(float32: Float32Array): Int16Array {
  const out = new Int16Array(float32.length)
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]))
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return out
}

function int16ToFloat32(int16: Int16Array): Float32Array {
  const out = new Float32Array(int16.length)
  for (let i = 0; i < int16.length; i++) {
    out[i] = int16[i] / (int16[i] < 0 ? 0x8000 : 0x7fff)
  }
  return out
}

function base64ToInt16(b64: string): Int16Array {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Int16Array(bytes.buffer)
}

function int16ToBase64(int16: Int16Array): string {
  const bytes = new Uint8Array(int16.buffer)
  let bin = ""
  // Chunk to avoid arg-limit on String.fromCharCode for large buffers.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(bin)
}

export type LiveStatus =
  | "idle"
  | "requesting_mic"
  | "connecting"
  | "live"
  | "reconnecting"
  | "ended"
  | "error"

export interface UseLiveInterviewOptions {
  /** Mint a fresh single-use ephemeral token (called on connect + reconnect). */
  mintToken: (voiceModel?: VoiceModel) => Promise<LiveTokenResponse>
  /** Persist finalised transcript turns to the backend. */
  onTurns: (turns: TranscriptTurn[]) => Promise<void> | void
  /** Called when the model invokes the `end_interview` tool. */
  onEndInterview: (reason: string) => void
  voiceModel?: VoiceModel
}

/**
 * Voice-to-voice Gemini Live controller for the AI interviewer.
 *
 * Owns the full audio pipeline: mic capture (AudioWorklet @ 16kHz) → base64 PCM
 * → `session.sendRealtimeInput`, and the reverse path of base64 24kHz PCM →
 * AudioBufferSourceNode playback queue. Surfaces a rolling transcript (from
 * server-side input/output transcription) and handles the `end_interview`
 * tool call. The browser never sees the real GEMINI_API_KEY — connection is
 * authenticated with a short-lived ephemeral token minted server-side with the
 * full session config (system prompt, tools, voice) locked in.
 */
export function useLiveInterview(opts: UseLiveInterviewOptions) {
  const optsRef = useRef(opts)
  useEffect(() => {
    optsRef.current = opts
  }, [opts])

  const [status, setStatus] = useState<LiveStatus>("idle")
  const [error, setError] = useState<string | null>(null)
  const [muted, setMuted] = useState(false)
  const [interviewerSpeaking, setInterviewerSpeaking] = useState(false)
  const [transcript, setTranscript] = useState<TranscriptTurn[]>([])
  // Partial (in-flight) transcription for the *current* turn, shown as a
  // shimmering preview before it's committed to `transcript`.
  const [liveUserText, setLiveUserText] = useState("")
  const [liveModelText, setLiveModelText] = useState("")

  // ---- refs (no re-render on change) -------------------------------------
  const sessionRef = useRef<Session | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const inputCtxRef = useRef<AudioContext | null>(null)
  const inputNodeRef = useRef<AudioWorkletNode | null>(null)
  const outputCtxRef = useRef<AudioContext | null>(null)
  const playheadRef = useRef(0) // absolute AudioContext time of the next free playback slot
  const scheduledRef = useRef<Set<AudioBufferSourceNode>>(new Set())
  const startedAtRef = useRef(0)
  const mutedRef = useRef(false)
  const userBufRef = useRef("")
  const modelBufRef = useRef("")
  const pendingTurnsRef = useRef<TranscriptTurn[]>([])
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const closingRef = useRef(false)

  const atMs = () => Math.round(performance.now() - startedAtRef.current)

  // ---- transcript persistence (debounced) --------------------------------
  const flushTurns = useCallback(() => {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current)
      flushTimerRef.current = null
    }
    const turns = pendingTurnsRef.current
    if (turns.length === 0) return Promise.resolve()
    pendingTurnsRef.current = []
    return Promise.resolve(optsRef.current.onTurns(turns)).catch((e) => {
      // Re-queue on failure so we retry on the next flush / on disconnect.
      pendingTurnsRef.current = [...turns, ...pendingTurnsRef.current]
      console.warn("[live] failed to persist transcript turns", e)
    })
  }, [])

  const queueTurn = useCallback(
    (turn: TranscriptTurn) => {
      setTranscript((prev) => [...prev, turn])
      pendingTurnsRef.current.push(turn)
      if (!flushTimerRef.current) {
        flushTimerRef.current = setTimeout(flushTurns, 1500)
      }
    },
    [flushTurns]
  )

  const commitUserTurn = useCallback(() => {
    const text = userBufRef.current.trim()
    userBufRef.current = ""
    setLiveUserText("")
    if (text) queueTurn({ role: "user", text, at_ms: atMs() })
  }, [queueTurn])

  const commitModelTurn = useCallback(() => {
    const text = modelBufRef.current.trim()
    modelBufRef.current = ""
    setLiveModelText("")
    if (text) queueTurn({ role: "model", text, at_ms: atMs() })
  }, [queueTurn])

  // ---- output audio (24kHz PCM playback queue) ---------------------------
  const stopPlayback = useCallback(() => {
    for (const node of scheduledRef.current) {
      try {
        node.stop()
      } catch {
        /* already stopped */
      }
    }
    scheduledRef.current.clear()
    if (outputCtxRef.current) {
      playheadRef.current = outputCtxRef.current.currentTime
    }
    setInterviewerSpeaking(false)
  }, [])

  const enqueueAudio = useCallback((b64: string) => {
    const ctx = outputCtxRef.current
    if (!ctx) return
    const pcm = int16ToFloat32(base64ToInt16(b64))
    if (pcm.length === 0) return
    const buf = ctx.createBuffer(1, pcm.length, OUTPUT_SAMPLE_RATE)
    buf.copyToChannel(pcm, 0)
    const node = ctx.createBufferSource()
    node.buffer = buf
    node.connect(ctx.destination)
    const startAt = Math.max(ctx.currentTime, playheadRef.current)
    node.start(startAt)
    playheadRef.current = startAt + buf.duration
    scheduledRef.current.add(node)
    setInterviewerSpeaking(true)
    node.onended = () => {
      scheduledRef.current.delete(node)
      if (scheduledRef.current.size === 0) setInterviewerSpeaking(false)
    }
  }, [])

  // ---- server message handler --------------------------------------------
  const handleMessage = useCallback(
    (msg: LiveServerMessage) => {
      if (msg.setupComplete) {
        setStatus("live")
      }

      const sc = msg.serverContent
      if (sc) {
        if (sc.interrupted) {
          // User barged in — drop any queued interviewer audio so the new
          // response doesn't play over the tail of the old one.
          stopPlayback()
          commitModelTurn()
        }
        if (sc.inputTranscription?.text) {
          userBufRef.current += sc.inputTranscription.text
          setLiveUserText(userBufRef.current)
        }
        if (sc.outputTranscription?.text) {
          // The model has started replying → the user's turn is over.
          if (userBufRef.current) commitUserTurn()
          modelBufRef.current += sc.outputTranscription.text
          setLiveModelText(modelBufRef.current)
        }
        for (const part of sc.modelTurn?.parts ?? []) {
          const data = part.inlineData?.data
          if (data && (part.inlineData?.mimeType ?? "").startsWith("audio/")) {
            enqueueAudio(data)
          }
        }
        if (sc.turnComplete || sc.generationComplete) {
          commitUserTurn()
          commitModelTurn()
        }
      }

      const calls = msg.toolCall?.functionCalls ?? []
      if (calls.length > 0) {
        const responses = calls.map((fc) => {
          if (fc.name === "end_interview") {
            const reason = String(
              (fc.args as Record<string, unknown> | undefined)?.reason ?? "completed"
            )
            // Defer so the tool response is sent before we tear down.
            setTimeout(() => optsRef.current.onEndInterview(reason), 0)
            return { id: fc.id, name: fc.name, response: { ok: true } }
          }
          return {
            id: fc.id,
            name: fc.name,
            response: { error: "unhandled tool on client" },
          }
        })
        try {
          sessionRef.current?.sendToolResponse({ functionResponses: responses })
        } catch (e) {
          console.warn("[live] sendToolResponse failed", e)
        }
      }
    },
    [enqueueAudio, stopPlayback, commitUserTurn, commitModelTurn]
  )

  // ---- input audio (mic → 16kHz PCM → sendRealtimeInput) -----------------
  const startMic = useCallback(async () => {
    setStatus("requesting_mic")
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    })
    micStreamRef.current = stream

    // Dedicated 16kHz input context so the worklet emits frames at the rate
    // Gemini expects without an extra resample step.
    const Ctx = (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext) as typeof AudioContext
    const inCtx = new Ctx({ sampleRate: INPUT_SAMPLE_RATE })
    inputCtxRef.current = inCtx
    const blob = new Blob([PCM_WORKLET_SRC], { type: "application/javascript" })
    const url = URL.createObjectURL(blob)
    await inCtx.audioWorklet.addModule(url)
    URL.revokeObjectURL(url)

    const source = inCtx.createMediaStreamSource(stream)
    const node = new AudioWorkletNode(inCtx, WORKLET_NAME)
    inputNodeRef.current = node
    node.port.onmessage = (ev: MessageEvent<Float32Array>) => {
      if (mutedRef.current || !sessionRef.current) return
      const pcm = floatTo16BitPCM(ev.data)
      try {
        sessionRef.current.sendRealtimeInput({
          audio: {
            data: int16ToBase64(pcm),
            mimeType: `audio/pcm;rate=${INPUT_SAMPLE_RATE}`,
          },
        })
      } catch {
        /* socket may be mid-reconnect; drop the frame */
      }
    }
    source.connect(node)

    // Separate output context at 24kHz for the interviewer's voice.
    const outCtx = new Ctx({ sampleRate: OUTPUT_SAMPLE_RATE })
    outputCtxRef.current = outCtx
    playheadRef.current = outCtx.currentTime
  }, [])

  const openSocket = useCallback(async () => {
    const { token, model, api_version } = await optsRef.current.mintToken(
      optsRef.current.voiceModel
    )
    const ai = new GoogleGenAI({
      apiKey: token,
      apiVersion: api_version || "v1alpha",
    })
    const session = await ai.live.connect({
      model,
      // Model, system prompt, tools, voice and transcription are all locked
      // into the ephemeral token server-side; we only need to declare the
      // response modality here so the SDK shapes its setup message correctly.
      config: { responseModalities: [Modality.AUDIO] },
      callbacks: {
        onopen: () => {
          /* `setupComplete` (handleMessage) flips status → "live" */
        },
        onmessage: handleMessage,
        onerror: (e) => {
          console.error("[live] socket error", e)
          setError(e?.message || "Live connection error")
        },
        onclose: (e) => {
          sessionRef.current = null
          // Commit any in-flight partial turns + persist before deciding what to do.
          commitUserTurn()
          commitModelTurn()
          void flushTurns()
          if (closingRef.current) {
            setStatus("ended")
            return
          }
          // Unplanned close → one reconnect attempt with a fresh token.
          console.warn("[live] socket closed", e?.code, e?.reason)
          setStatus("reconnecting")
          openSocket().catch((err) => {
            setError(err instanceof Error ? err.message : "Reconnect failed")
            setStatus("error")
          })
        },
      },
    })
    sessionRef.current = session
  }, [handleMessage, commitUserTurn, commitModelTurn, flushTurns])

  // ---- teardown (release mic/contexts/socket; no state changes) ----------
  const teardown = useCallback(() => {
    stopPlayback()
    try {
      sessionRef.current?.close()
    } catch {
      /* already closed */
    }
    sessionRef.current = null
    if (inputNodeRef.current) {
      inputNodeRef.current.port.onmessage = null
      inputNodeRef.current.disconnect()
      inputNodeRef.current = null
    }
    if (inputCtxRef.current) {
      void inputCtxRef.current.close().catch(() => {})
      inputCtxRef.current = null
    }
    if (outputCtxRef.current) {
      void outputCtxRef.current.close().catch(() => {})
      outputCtxRef.current = null
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop())
      micStreamRef.current = null
    }
  }, [stopPlayback])

  // ---- public controls ----------------------------------------------------
  const connect = useCallback(async () => {
    if (status === "live" || status === "connecting" || status === "requesting_mic") return
    setError(null)
    closingRef.current = false
    startedAtRef.current = performance.now()
    try {
      await startMic()
      setStatus("connecting")
      await openSocket()
      // Greet so the model speaks first without the candidate having to.
      try {
        sessionRef.current?.sendClientContent({
          turns: [
            {
              role: "user",
              parts: [{ text: "(The candidate has joined. Begin the interview.)" }],
            },
          ],
          turnComplete: true,
        })
      } catch {
        /* non-fatal */
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to start interview audio"
      setError(msg)
      setStatus("error")
      closingRef.current = true
      teardown()
      throw e
    }
  }, [status, startMic, openSocket, teardown])

  const disconnect = useCallback(async () => {
    closingRef.current = true
    teardown()
    commitUserTurn()
    commitModelTurn()
    await flushTurns()
    // Don't flip idle→ended: if we never connected (e.g. React strict-mode dev
    // double-invokes the unmount cleanup before the user clicks Join), keep the
    // hook resumable. Preserve "error" so the UI can surface the failure.
    setStatus((s) => (s === "idle" || s === "error" ? s : "ended"))
  }, [teardown, commitUserTurn, commitModelTurn, flushTurns])

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m
      mutedRef.current = next
      if (next) {
        // Tell the server the input stream paused so VAD doesn't wait on silence.
        try {
          sessionRef.current?.sendRealtimeInput({ audioStreamEnd: true })
        } catch {
          /* ignore */
        }
      }
      return next
    })
  }, [])

  // ---- cleanup on unmount ------------------------------------------------
  // Resource-only teardown (no state changes) so React strict-mode's dev-time
  // mount→unmount→mount cycle doesn't leave the hook stuck in "ended".
  useEffect(() => {
    return () => {
      closingRef.current = true
      teardown()
      void flushTurns()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    status,
    error,
    muted,
    interviewerSpeaking,
    transcript,
    liveUserText,
    liveModelText,
    connect,
    disconnect,
    toggleMute,
  }
}
