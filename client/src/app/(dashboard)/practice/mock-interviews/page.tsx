'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

import { FaPlay, FaPause, FaRedo, FaUndo } from 'react-icons/fa';

const STORAGE_KEY = 'mockInterviewTimer';

type TimerState = {
  duration: number;       // total duration in seconds
  timer: number;          // remaining time in seconds
  isRunning: boolean;     // is timer currently running?
  lastTimestamp: number;  // timestamp (ms) when timer last started or updated
};

export default function MockInterviewsPage() {
  const [selectedType, setSelectedType] = useState("technical");
  const [selectedDifficulty, setSelectedDifficulty] = useState("intermediate");

  // Duration in seconds
  const [duration, setDuration] = useState(45 * 60);
  const [timer, setTimer] = useState(duration);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load timer state from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const state: TimerState = JSON.parse(saved);

        if (state.isRunning) {
          const now = Date.now();
          const elapsed = Math.floor((now - state.lastTimestamp) / 1000);
          const newTimer = state.timer - elapsed;
          if (newTimer > 0) {
            setTimer(newTimer);
            setDuration(state.duration);
            setIsRunning(true);
            startInterval(newTimer);
          } else {
            setTimer(0);
            setDuration(state.duration);
            setIsRunning(false);
            clearInterval(intervalRef.current!);
          }
        } else {
          setTimer(state.timer);
          setDuration(state.duration);
          setIsRunning(false);
        }
      } catch {
        setTimer(duration);
        setIsRunning(false);
      }
    } else {
      setTimer(duration);
      setIsRunning(false);
    }
  }, []);

  // Save timer state whenever timer or isRunning or duration changes
  useEffect(() => {
    const state: TimerState = {
      duration,
      timer,
      isRunning,
      lastTimestamp: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [timer, isRunning, duration]);

  // Clear interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const startInterval = (startTime: number) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          setIsRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const startTimer = () => {
    setIsRunning(true);
    startInterval(timer);
  };

  const pauseTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsRunning(false);
  };

  const resumeTimer = () => {
    if (!isRunning && timer > 0) {
      setIsRunning(true);
      startInterval(timer);
    }
  };

  const resetTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setTimer(duration);
    setIsRunning(false);
  };

  // When user selects a quick duration, update duration and reset timer
  const handleDurationChange = (seconds: number) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setDuration(seconds);
    setTimer(seconds);
    setIsRunning(false);
  };

  const formatTime = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
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
            {/* Interview Type */}
            <div>
              <label className="block text-sm font-medium">Interview Type</label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-gray-800 text-white"
              >
                <option value="technical">Technical</option>
                <option value="behavioral">Behavioral</option>
                <option value="system-design">System Design</option>
              </select>
            </div>

            {/* Difficulty Level */}
            <div>
              <label className="block text-sm font-medium">Difficulty Level</label>
              <select
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-gray-800 text-white"
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>

            {/* Quick Duration Selection */}
            <div>
              <label className="block text-sm font-medium mb-1">Choose Interview Duration</label>
              <div className="flex space-x-2 mb-2">
                {[30, 45, 60].map((min) => (
                  <Button
                    key={min}
                    variant={duration === min * 60 ? "default" : "outline"}
                    onClick={() => handleDurationChange(min * 60)}
                  >
                    {min} min
                  </Button>
                ))}
              </div>

              {/* Dropdown for other options */}
              <select
                value={duration / 60}
                onChange={(e) => handleDurationChange(Number(e.target.value) * 60)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-gray-800 text-white"
              >
                {[15, 20, 30, 45, 60, 90].map((min) => (
                  <option key={min} value={min}>{min} minutes</option>
                ))}
              </select>
            </div>

            {/* Timer Controls */}
            <div className="space-x-2 mt-4 flex items-center">
              {!isRunning && timer === duration && (
                <Button variant="outline" onClick={startTimer} className="flex items-center space-x-1">
                  <FaPlay /> <span>Start Timer</span>
                </Button>
              )}
              {isRunning && (
                <Button variant="outline" onClick={pauseTimer} className="flex items-center space-x-1">
                  <FaPause /> <span>Pause</span>
                </Button>
              )}
              {!isRunning && timer !== duration && timer > 0 && (
                <Button variant="outline" onClick={resumeTimer} className="flex items-center space-x-1">
                  <FaRedo /> <span>Resume</span>
                </Button>
              )}
              <Button variant="outline" onClick={resetTimer} className="flex items-center space-x-1">
                <FaUndo /> <span>Reset</span>
              </Button>
            </div>

            {/* Timer Display */}
            <p className="text-lg font-bold mt-2">Time Remaining: {formatTime(timer)}</p>

            {/* Begin Interview */}
            <Link href="/practice/mock-interviews/session">
              <Button variant="outline" className="mt-4">Begin Interview</Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Interview History */}
      <h2 className="text-2xl font-bold mt-8">Interview History</h2>
      <Card>
        <CardHeader>
          <CardTitle>Past Interviews</CardTitle>
          <CardDescription>Review your previous mock interviews</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            <li className="flex justify-between"><span>Technical Interview</span><span>Score: 85</span></li>
            <li className="flex justify-between"><span>Behavioral Interview</span><span>Score: 90</span></li>
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
          <ul className="space-y-2">
            <li><Link href="#" className="text-blue-500 hover:underline">Interview Tips</Link></li>
            <li><Link href="#" className="text-blue-500 hover:underline">Common Questions</Link></li>
            <li><Link href="#" className="text-blue-500 hover:underline">Practice Problems</Link></li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}