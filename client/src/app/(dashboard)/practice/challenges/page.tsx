'use client';

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { FiPlay, FiPause, FiRotateCw } from "react-icons/fi";

export default function CodingChallengesPage() {
  const [selectedCategory, setSelectedCategory] = useState("algorithms");
  const [selectedDifficulty, setSelectedDifficulty] = useState("medium");
  const [timer, setTimer] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const timerOptions = [30, 45, 60];
  const [customMinutes, setCustomMinutes] = useState("");

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

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // Timer quick select
  const handleTimerSelect = (min: number) => {
    setTimer(min * 60);
    setCustomMinutes("");
    setTimerActive(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  // Custom input for timer
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

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Coding Challenges</h1>
      <Card>
        <CardHeader>
          <CardTitle>Start a Challenge</CardTitle>
          <CardDescription>Practice with timed coding challenges</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-col gap-4 md:flex-row md:gap-8">
              <div className="flex-1">
                <label htmlFor="challenge-category" className="block text-sm font-medium mb-2">Challenge Category</label>
                <select
                  id="challenge-category"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-gray-800 text-white px-4 py-3 text-base"
                >
                  <option value="algorithms">Algorithms</option>
                  <option value="data-structures">Data Structures</option>
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
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
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
                  className="w-32 px-3 py-2 rounded-full border border-gray-300 bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center appearance-none"
                  style={{ WebkitAppearance: 'none', MozAppearance: 'textfield' }}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">min</span>
              </div>
            </div>
            <div className="flex gap-2">
              {(() => {
                let timerButtonContent;
                if (timerActive) {
                  timerButtonContent = (
                    <>
                      <FiPlay className="inline mr-1 text-green-500" /> <span className="text-green-600">Running...</span>
                    </>
                  );
                } else if (!hasStarted) {
                  timerButtonContent = (
                    <>
                      <FiPlay className="inline mr-1 text-green-500" /> <span className="text-green-600">Start Timer</span>
                    </>
                  );
                } else {
                  timerButtonContent = (
                    <>
                      <FiPlay className="inline mr-1 text-blue-500" /> <span className="text-blue-600">Resume</span>
                    </>
                  );
                }
                return (
                  <Button variant="outline" onClick={startTimer} disabled={timerActive || timer === 0}>
                    {timerButtonContent}
                  </Button>
                );
              })()}
              <Button variant="outline" onClick={pauseTimer} disabled={!timerActive}>
                <FiPause className="inline mr-1 text-blue-500" /> <span className="text-blue-600">Pause</span>
              </Button>
              <Button variant="outline" onClick={resetTimer}>
                <FiRotateCw className="inline mr-1 text-red-500" /> <span className="text-red-600">Reset</span>
              </Button>
            </div>
            <p className="text-lg font-bold">Time Remaining: {Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, '0')}</p>
            <Link href="/practice/challenges/session">
              <Button variant="outline">Begin Challenge</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
      <h2 className="text-2xl font-bold mt-8">Challenge History</h2>
      <Card>
        <CardHeader>
          <CardTitle>Past Challenges</CardTitle>
          <CardDescription>Review your previous coding challenges</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            <li className="flex justify-between">
              <span>Algorithms Challenge</span>
              <span>Score: 85</span>
            </li>
            <li className="flex justify-between">
              <span>Data Structures Challenge</span>
              <span>Score: 90</span>
            </li>
          </ul>
        </CardContent>
      </Card>
      <h2 className="text-2xl font-bold mt-8">Leaderboard</h2>
      <Card>
        <CardHeader>
          <CardTitle>Top Performers</CardTitle>
          <CardDescription>See who's leading the coding challenges</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            <li className="flex justify-between">
              <span>User 1</span>
              <span>Score: 95</span>
            </li>
            <li className="flex justify-between">
              <span>User 2</span>
              <span>Score: 90</span>
            </li>
            <li className="flex justify-between">
              <span>User 3</span>
              <span>Score: 85</span>
            </li>
          </ul>
        </CardContent>
      </Card>
      <h2 className="text-2xl font-bold mt-8">Feedback</h2>
      <Card>
        <CardHeader>
          <CardTitle>Submit Feedback</CardTitle>
          <CardDescription>Share your thoughts on the challenge experience</CardDescription>
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
      <h2 className="text-2xl font-bold mt-8">Resources</h2>
      <Card>
        <CardHeader>
          <CardTitle>Coding Resources</CardTitle>
          <CardDescription>Helpful resources for coding practice</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            <li><Link href="#" className="text-blue-500 hover:underline">Coding Tips</Link></li>
            <li><Link href="#" className="text-blue-500 hover:underline">Practice Problems</Link></li>
            <li><Link href="#" className="text-blue-500 hover:underline">Tutorials</Link></li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}