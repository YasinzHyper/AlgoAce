// InterviewCamera.tsx
'use client';

import { useEffect, useRef, useState } from "react";

// Custom Hook: Shake detection
export function useShakeDetector(videoRef: React.RefObject<HTMLVideoElement | null>, onShake: () => void) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastImageDataRef = useRef<ImageData | null>(null);

  useEffect(() => {
    canvasRef.current = document.createElement("canvas");

    const detect = () => {
      if (!videoRef.current || videoRef.current.readyState !== 4) return;

      const canvas = canvasRef.current!;
      const context = canvas.getContext("2d")!;
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;

      context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

      if (lastImageDataRef.current) {
        const diff = pixelDiff(lastImageDataRef.current.data, imageData.data);
        if (diff > 25) {
          onShake();
        }
      }

      lastImageDataRef.current = imageData;
    };

    const interval = setInterval(detect, 500); // Check every 500ms

    return () => clearInterval(interval);
  }, [videoRef, onShake]);

  function pixelDiff(data1: Uint8ClampedArray, data2: Uint8ClampedArray): number {
    let diff = 0;
    for (let i = 0; i < data1.length; i += 4) {
      diff += Math.abs(data1[i] - data2[i]); // Only comparing the red channel for simplicity
    }
    return diff / (data1.length / 4); // Average per pixel
  }
}

export default function InterviewCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [alertShown, setAlertShown] = useState(false);

  // Callback function to show alert when shaking is detected
  const handleShake = () => {
    if (!alertShown) {
      alert("Stay calm and focused! 😊");
      setAlertShown(true);
      setTimeout(() => setAlertShown(false), 10000); // Disable alert for 10 seconds after showing
    }
  };

  // Use the shake detection hook
  useShakeDetector(videoRef, handleShake);

  useEffect(() => {
    const getCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Camera access denied", err);
      }
    };

    getCamera();
  }, []);

  return (
    <div className="my-4">
      <p className="text-sm text-gray-500 mb-2">Camera Active – Motion monitored</p>
      <video ref={videoRef} autoPlay muted className="w-full max-w-md rounded-md border" />
    </div>
  );
}
