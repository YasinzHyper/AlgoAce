'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

// Custom Hook for Shake Detection
export function useShakeDetector(videoRef: React.RefObject<HTMLVideoElement | null>, onShake: () => void) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastImageDataRef = useRef<ImageData | null>(null);

  useEffect(() => {
    canvasRef.current = document.createElement('canvas');

    const detect = () => {
      if (!videoRef.current || videoRef.current.readyState !== 4) return;

      const canvas = canvasRef.current!;
      const context = canvas.getContext('2d')!;
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

  // Simple pixel comparison
  function pixelDiff(data1: Uint8ClampedArray, data2: Uint8ClampedArray): number {
    let diff = 0;
    for (let i = 0; i < data1.length; i += 4) {
      diff += Math.abs(data1[i] - data2[i]); // Only comparing the red channel for simplicity
    }
    return diff / (data1.length / 4); // Average per pixel
  }
}

// Interview Camera Component
export default function MockInterviewsPage() {
  const [selectedType, setSelectedType] = useState('technical');
  const [selectedDifficulty, setSelectedDifficulty] = useState('intermediate');
  const [timer, setTimer] = useState(0);
  const [alertShown, setAlertShown] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [timerActive, setTimerActive] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);

  // Add timer options
  const timerOptions = [30, 45, 60]; // in minutes
  const [customMinutes, setCustomMinutes] = useState('');

  // Handle shake detection alert
  const handleShake = () => {
    if (!alertShown) {
      alert('Stay calm and focused! 😊');
      setAlertShown(true);
      setTimeout(() => setAlertShown(false), 10000); // Disable alert for 10 seconds
    }
  };

  // Start Timer Function
  const startTimer = () => {
    // If customMinutes is set, use that, else use timer
    let seconds = timer;
    if (customMinutes) {
      seconds = parseInt(customMinutes, 10) * 60;
    }
    if (!seconds || isNaN(seconds)) {
      seconds = 45 * 60;
    }
    setTimer(seconds);
    setTimerActive(true);
    const interval = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 0) {
          clearInterval(interval);
          setTimerActive(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Pause Timer Function
  const pauseTimer = () => {
    setTimerActive(false);
  };

  // Reset Timer Function
  const resetTimer = () => {
    setTimer(0);
    setTimerActive(false);
  };

  // Timer selection handler
  const handleTimerSelect = (minutes: number) => {
    setTimer(minutes * 60);
    setCustomMinutes('');
    setTimerActive(false);
  };

  // Custom input handler
  const handleCustomInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, '');
    setCustomMinutes(val);
    if (val) {
      setTimer(parseInt(val, 10) * 60);
      setTimerActive(false);
    }
  };

  // Camera Setup
  useEffect(() => {
    let stream: MediaStream | null = null;
    const getCamera = async () => {
      if (!cameraOn) {
        if (videoRef.current && videoRef.current.srcObject) {
          (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
          videoRef.current.srcObject = null;
        }
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error('Camera access denied', err);
      }
    };
    getCamera();
    return () => {
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
  }, [cameraOn]);

  // Use Shake Detection
  useShakeDetector(videoRef, handleShake);

  // Handle Camera Toggle
  const handleCameraToggle = () => {
    setCameraOn((prev) => !prev);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Mock Interviews</h1>

      <Card>
        <CardHeader>
          <CardTitle>Start a Mock Interview</CardTitle>
          <CardDescription>Simulate a real interview scenario</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-col gap-4 md:flex-row md:gap-8">
              <div className="flex-1">
                <label htmlFor="interview-type" className="block text-sm font-medium mb-2">Interview Type</label>
                <select
                  id="interview-type"
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-gray-800 text-white px-4 py-3 text-base"
                >
                  <option value="technical">Technical</option>
                  <option value="behavioral">Behavioral</option>
                  <option value="system-design">System Design</option>
                </select>
              </div>
              <div className="flex-1">
                <label htmlFor="difficulty-level" className="block text-sm font-medium mb-2">Difficulty Level</label>
                <select
                  id="difficulty-level"
                  value={selectedDifficulty}
                  onChange={(e) => setSelectedDifficulty(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-gray-800 text-white px-4 py-3 text-base"
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>
            </div>
            {/* Timer quick select - fancier UI */}
            <div className="flex flex-wrap gap-2 mb-2 items-center">
              {timerOptions.map((min) => (
                <Button
                  key={min}
                  variant={timer === min * 60 ? 'default' : 'outline'}
                  onClick={() => handleTimerSelect(min)}
                  className={`rounded-full px-6 py-2 font-semibold transition-all duration-150 ${timer === min * 60 ? 'ring-2 ring-indigo-400' : ''}`}
                >
                  {min} min
                </Button>
              ))}
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  placeholder="Custom"
                  value={customMinutes}
                  onChange={handleCustomInput}
                  className="w-24 px-3 py-2 rounded-full border border-gray-300 bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center appearance-none"
                  style={{ WebkitAppearance: 'none', MozAppearance: 'textfield' }}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">min</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={startTimer} disabled={timer > 0 && timerActive || timer === 0}>
                Start Timer
              </Button>
              <Button variant="outline" onClick={pauseTimer} disabled={!timerActive}>
                Pause
              </Button>
              <Button variant="outline" onClick={resetTimer}>
                Reset
              </Button>
            </div>
            <p className="text-lg font-bold">Time Remaining: {Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, '0')}</p>
            <Link href="/practice/mock-interviews/session">
              <Button variant="outline">Begin Interview</Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Add Camera */}
      <div className="my-4">
        <div className="flex items-center gap-2 mb-2">
          <Button variant="outline" onClick={handleCameraToggle}>{cameraOn ? 'Turn Camera Off' : 'Turn Camera On'}</Button>
          <span className="text-sm text-gray-500">Camera {cameraOn ? 'On' : 'Off'} – Motion monitored</span>
        </div>
        <video ref={videoRef} autoPlay muted className="w-full max-w-md rounded-md border" style={{ display: cameraOn ? 'block' : 'none' }} />
      </div>

      {/* Interview History */}
      <h2 className="text-2xl font-bold mt-8">Interview History</h2>
      <Card>
        <CardHeader>
          <CardTitle>Past Interviews</CardTitle>
          <CardDescription>Review your previous mock interviews</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            <li className="flex justify-between">
              <span>Technical Interview</span>
              <span>Score: 85</span>
            </li>
            <li className="flex justify-between">
              <span>Behavioral Interview</span>
              <span>Score: 90</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Feedback */}
      <h2 className="text-2xl font-bold mt-8">Feedback</h2>
      <Card>
        <CardHeader>
          <CardTitle>Submit Feedback</CardTitle>
          <CardDescription>Share your thoughts on the interview experience</CardDescription>
        </CardHeader>
        <CardContent>
          <textarea
            className="w-full p-2 border rounded-md"
            placeholder="Enter your feedback here..."
            rows={4}
          />
          <Button variant="outline" className="mt-2">Submit Feedback</Button>
        </CardContent>
      </Card>

      {/* Resources */}
      <h2 className="text-2xl font-bold mt-8">Resources</h2>
      <Card>
        <CardHeader>
          <CardTitle>Interview Preparation</CardTitle>
          <CardDescription>Helpful resources for interview preparation</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1">
            <li><Link href="#" className="text-blue-500 hover:underline">Interview Tips</Link></li>
            <li><Link href="#" className="text-blue-500 hover:underline">Common Questions</Link></li>
            <li><Link href="#" className="text-blue-500 hover:underline">Practice Problems</Link></li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
