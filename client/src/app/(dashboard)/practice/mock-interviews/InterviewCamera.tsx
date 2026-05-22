// InterviewCamera.tsx
'use client';

import { useEffect, useRef, useState } from "react";
import { useShakeDetector } from "@/hooks/use-shake-detector";

// Re-export for backward compatibility — the canonical implementation now
// lives in `@/hooks/use-shake-detector`.
export { useShakeDetector };

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
