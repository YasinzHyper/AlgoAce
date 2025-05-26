'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useState } from "react";

export default function CodingChallengesPage() {
  const [selectedCategory, setSelectedCategory] = useState("algorithms");
  const [selectedDifficulty, setSelectedDifficulty] = useState("medium");
  const [timer, setTimer] = useState(0);

  const startTimer = () => {
    setTimer(60 * 60); // 60 minutes
    const interval = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 0) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
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
            <div>
              <label className="block text-sm font-medium">Challenge Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-gray-800 text-white"
              >
                <option value="algorithms">Algorithms</option>
                <option value="data-structures">Data Structures</option>
                <option value="system-design">System Design</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium">Difficulty Level</label>
              <select
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-gray-800 text-white"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <Button variant="outline" onClick={startTimer}>
              Start Timer
            </Button>
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