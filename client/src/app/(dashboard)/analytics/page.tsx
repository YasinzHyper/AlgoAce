'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ProgressOverviewPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Progress Overview</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Completed Problems</CardTitle>
            <CardDescription>Total problems solved</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">42</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Current Streak</CardTitle>
            <CardDescription>Days of consistent practice</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">7</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Average Score</CardTitle>
            <CardDescription>Based on problem difficulty</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">85%</p>
          </CardContent>
        </Card>
      </div>
      <h2 className="text-2xl font-bold mt-8">Detailed Analytics</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Problem Difficulty Distribution</CardTitle>
            <CardDescription>Breakdown of solved problems by difficulty</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">Easy: 20</p>
            <p className="text-2xl font-bold">Medium: 15</p>
            <p className="text-2xl font-bold">Hard: 7</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Topic Mastery</CardTitle>
            <CardDescription>Progress by topic</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">Arrays: 90%</p>
            <p className="text-2xl font-bold">Strings: 85%</p>
            <p className="text-2xl font-bold">Dynamic Programming: 70%</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Time Spent</CardTitle>
            <CardDescription>Total hours dedicated to practice</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">120</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 