'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageHeader } from '@/components/layout/page-header';
import Link from 'next/link';
import {
  Camera,
  CameraOff,
  Pause,
  Play,
  RotateCcw,
  Timer,
  Video,
} from 'lucide-react';

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
  const [hasStarted, setHasStarted] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

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

  // Timer logic
  const startTimer = () => {
    if (timerActive || timer === 0) return;
    setTimerActive(true);
    setHasStarted(true);
    timerRef.current = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 0) {
          clearInterval(timerRef.current!);
          setTimerActive(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const pauseTimer = () => {
    setTimerActive(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const resetTimer = () => {
    setTimer(0);
    setTimerActive(false);
    setHasStarted(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  // Clean up timer on unmount
  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // Camera Setup
  useEffect(() => {
    let stream: MediaStream | null = null;
    const getCamera = async () => {
      setCameraError(null);
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
      } catch (err: any) {
        setCameraError('Camera access denied or unavailable. Please allow camera permissions in your browser settings.');
        console.error('Camera access denied', err);
      }
    };
    getCamera();
    return () => {
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
  }, [cameraOn, cameraError]);

  // Use Shake Detection
  useShakeDetector(videoRef, handleShake);

  // Handle Camera Toggle
  const handleCameraToggle = () => {
    setCameraOn((prev) => !prev);
  };

  // Handle timer quick-select
  const handleTimerSelect = (min: number) => {
    setTimer(min * 60);
    setCustomMinutes("");
    setTimerActive(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  // Handle custom input for timer
  const handleCustomInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCustomMinutes(value);
    const min = parseInt(value, 10);
    if (!isNaN(min) && min > 0) {
      setTimer(min * 60);
    } else {
      setTimer(0);
    }
  };

  const formatTime = (seconds: number) =>
    `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, "0")}`;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Mock Interviews"
        description="Simulate a real interview scenario with timed prompts and optional live camera."
      />

      <Card>
        <CardHeader>
          <CardTitle>Start a Mock Interview</CardTitle>
          <CardDescription>
            Pick the format, difficulty, and session length, then jump in.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="interview-type">Interview type</Label>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger id="interview-type" className="w-full">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="technical">Technical</SelectItem>
                  <SelectItem value="behavioral">Behavioral</SelectItem>
                  <SelectItem value="system-design">System Design</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="difficulty-level">Difficulty level</Label>
              <Select
                value={selectedDifficulty}
                onValueChange={setSelectedDifficulty}
              >
                <SelectTrigger id="difficulty-level" className="w-full">
                  <SelectValue placeholder="Select difficulty" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Session length</Label>
            <div className="flex flex-wrap items-center gap-2">
              {timerOptions.map((min) => (
                <Button
                  key={min}
                  type="button"
                  variant={timer === min * 60 ? "default" : "outline"}
                  onClick={() => handleTimerSelect(min)}
                  className="rounded-full"
                >
                  {min} min
                </Button>
              ))}
              <div className="relative w-32">
                <Input
                  type="number"
                  min={1}
                  placeholder="Custom"
                  value={customMinutes}
                  onChange={handleCustomInput}
                  className="rounded-full pr-10 text-center"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  min
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Timer className="size-5" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">
                    Time remaining
                  </p>
                  <p className="font-mono text-2xl font-bold tabular-nums">
                    {formatTime(timer)}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={startTimer}
                  disabled={timerActive || timer === 0}
                >
                  <Play className="size-4" />
                  {timerActive
                    ? "Running"
                    : !hasStarted
                      ? "Start"
                      : "Resume"}
                </Button>
                <Button
                  variant="outline"
                  onClick={pauseTimer}
                  disabled={!timerActive}
                >
                  <Pause className="size-4" />
                  Pause
                </Button>
                <Button variant="outline" onClick={resetTimer}>
                  <RotateCcw className="size-4" />
                  Reset
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="border-t">
          <Button asChild>
            <Link href="/practice/mock-interviews/session">
              <Video className="size-4" />
              Begin interview
            </Link>
          </Button>
        </CardFooter>
      </Card>

      {/* Camera */}
      <Card>
        <CardHeader>
          <CardTitle>Live camera</CardTitle>
          <CardDescription>
            Optional. Motion is monitored locally to remind you to stay calm —
            no video is uploaded.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {cameraOn && !videoRef.current?.srcObject && !cameraError && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
              Please allow camera access in your browser to enable this feature.
            </div>
          )}
          {cameraError && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {cameraError}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={handleCameraToggle}>
              {cameraOn ? (
                <>
                  <CameraOff className="size-4" />
                  Turn camera off
                </>
              ) : (
                <>
                  <Camera className="size-4" />
                  Turn camera on
                </>
              )}
            </Button>
            <Badge variant={cameraOn ? "default" : "secondary"}>
              {cameraOn ? "Motion monitored" : "Camera off"}
            </Badge>
          </div>
          <video
            ref={videoRef}
            autoPlay
            muted
            className="aspect-video w-full max-w-md rounded-lg border bg-muted object-cover"
            style={{ display: cameraOn ? "block" : "none" }}
          />
        </CardContent>
      </Card>

      {/* Interview History */}
      <Card>
        <CardHeader>
          <CardTitle>Past Interviews</CardTitle>
          <CardDescription>Review your previous mock interviews</CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          <div className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
            <span className="font-medium">Technical Interview</span>
            <Badge variant="secondary">Score 85</Badge>
          </div>
          <div className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
            <span className="font-medium">Behavioral Interview</span>
            <Badge variant="secondary">Score 90</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Feedback */}
      <Card>
        <CardHeader>
          <CardTitle>Submit feedback</CardTitle>
          <CardDescription>
            Share your thoughts on the interview experience
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea placeholder="What worked well, what could be better..." rows={4} />
          <Button variant="outline">Submit feedback</Button>
        </CardContent>
      </Card>

      {/* Resources */}
      <Card>
        <CardHeader>
          <CardTitle>Interview preparation</CardTitle>
          <CardDescription>Helpful resources for your next session</CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          {[
            { label: "Interview tips", href: "#" },
            { label: "Common questions", href: "#" },
            { label: "Practice problems", href: "/problems" },
          ].map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="flex items-center justify-between py-3 text-sm font-medium transition-colors first:pt-0 last:pb-0 hover:text-primary"
            >
              {link.label}
              <span aria-hidden className="text-muted-foreground">→</span>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
