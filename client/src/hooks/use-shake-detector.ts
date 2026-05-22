"use client"

import { useEffect, useRef } from "react"

/**
 * Lightweight motion / shake detector for a `<video>` element. Samples the
 * video frame every 500ms, compares red-channel intensity against the previous
 * sample, and fires `onShake` when the average per-pixel delta exceeds
 * `threshold`. All processing happens locally — no frames are uploaded.
 *
 * Used by the mock-interview camera to nudge the user to stay still / focused.
 */
export function useShakeDetector(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  onShake: () => void,
  options: { threshold?: number; intervalMs?: number } = {}
) {
  const { threshold = 25, intervalMs = 500 } = options
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const lastImageDataRef = useRef<ImageData | null>(null)
  const onShakeRef = useRef(onShake)

  // Keep the latest callback without re-subscribing the interval.
  useEffect(() => {
    onShakeRef.current = onShake
  }, [onShake])

  useEffect(() => {
    canvasRef.current = document.createElement("canvas")

    const detect = () => {
      const video = videoRef.current
      if (!video || video.readyState !== 4) return

      const canvas = canvasRef.current!
      const context = canvas.getContext("2d")
      if (!context) return
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight

      context.drawImage(video, 0, 0, canvas.width, canvas.height)
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height)

      if (lastImageDataRef.current) {
        const diff = pixelDiff(lastImageDataRef.current.data, imageData.data)
        if (diff > threshold) {
          onShakeRef.current()
        }
      }

      lastImageDataRef.current = imageData
    }

    const interval = setInterval(detect, intervalMs)
    return () => clearInterval(interval)
  }, [videoRef, threshold, intervalMs])
}

// Simple per-pixel red-channel delta. Cheap and good enough for "are you
// fidgeting" detection without pulling in a CV library.
function pixelDiff(data1: Uint8ClampedArray, data2: Uint8ClampedArray): number {
  let diff = 0
  for (let i = 0; i < data1.length; i += 4) {
    diff += Math.abs(data1[i] - data2[i])
  }
  return diff / (data1.length / 4)
}
