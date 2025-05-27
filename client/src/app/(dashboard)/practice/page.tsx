'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function PracticeOverviewPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Practice Overview</h1>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Mock Interviews</CardTitle>
            <CardDescription>Simulate real interview scenarios</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/practice/mock-interviews">
              <Button variant="outline">Start Mock Interview</Button>
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Coding Challenges</CardTitle>
            <CardDescription>Practice with timed coding challenges</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/practice/challenges">
              <Button variant="outline">Start Challenge</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
      <h2 className="text-2xl font-bold mt-8">Practice Statistics</h2>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Total Sessions</CardTitle>
            <CardDescription>Number of practice sessions completed</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">15</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Average Duration</CardTitle>
            <CardDescription>Average time spent per session</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">45 min</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Success Rate</CardTitle>
            <CardDescription>Percentage of challenges completed successfully</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">80%</p>
          </CardContent>
        </Card>
      </div>
      <h2 className="text-2xl font-bold mt-8">Recent Activity</h2>
      <Card>
        <CardHeader>
          <CardTitle>Last Session</CardTitle>
          <CardDescription>Details of your last practice session</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-lg">Mock Interview: System Design</p>
          <p className="text-sm text-gray-500">Completed on: 2023-10-01</p>
        </CardContent>
      </Card>
      <h2 className="text-2xl font-bold mt-8">Recommended Challenges</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Challenge 1</CardTitle>
            <CardDescription>Recommended based on your skill level</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/practice/challenges/1">
              <Button variant="outline">Start Challenge</Button>
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Challenge 2</CardTitle>
            <CardDescription>Recommended based on your skill level</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/practice/challenges/2">
              <Button variant="outline">Start Challenge</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
      <h2 className="text-2xl font-bold mt-8">Practice Goals</h2>
      <Card>
        <CardHeader>
          <CardTitle>Set Your Goals</CardTitle>
          <CardDescription>Define your practice goals for the week</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline">Set Goals</Button>
        </CardContent>
      </Card>
      <h2 className="text-2xl font-bold mt-8">Leaderboard</h2>
      <Card>
        <CardHeader>
          <CardTitle>Top Performers</CardTitle>
          <CardDescription>See who's leading the practice sessions</CardDescription>
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
    </div>
  );
} 