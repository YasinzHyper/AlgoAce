'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useState } from "react";

export default function MockInterviewsPage() {
  const [selectedType, setSelectedType] = useState("technical");
  const [selectedDifficulty, setSelectedDifficulty] = useState("intermediate");
  const [timer, setTimer] = useState(0);

  const startTimer = () => {
    setTimer(45 * 60); // 45 minutes
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
      <h1 className="text-3xl font-bold">Mock Interviews</h1>
      <Card>
        <CardHeader>
          <CardTitle>Start a Mock Interview</CardTitle>
          <CardDescription>Simulate a real interview scenario</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
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
            <Button variant="outline" onClick={startTimer}>
              Start Timer
            </Button>
            <p className="text-lg font-bold">Time Remaining: {Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, '0')}</p>
            <Link href="/practice/mock-interviews/session">
              <Button variant="outline">Begin Interview</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
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