'use client';

import { useState, useRef, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/layout/page-header";
import Link from "next/link";
import { Pause, Play, RotateCcw, Timer, Trophy } from "lucide-react";

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

  const formatTime = (seconds: number) =>
    `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, "0")}`;

  const leaderboard = [
    { rank: 1, name: "User 1", score: 95 },
    { rank: 2, name: "User 2", score: 90 },
    { rank: 3, name: "User 3", score: 85 },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Coding Challenges"
        description="Sharpen your skills with timed, curated coding challenges."
      />

      <Card>
        <CardHeader>
          <CardTitle>Start a Challenge</CardTitle>
          <CardDescription>
            Choose a category, difficulty, and session length.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="challenge-category">Challenge category</Label>
              <Select
                value={selectedCategory}
                onValueChange={setSelectedCategory}
              >
                <SelectTrigger id="challenge-category" className="w-full">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="algorithms">Algorithms</SelectItem>
                  <SelectItem value="data-structures">Data Structures</SelectItem>
                  <SelectItem value="system-design">System Design</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="challenge-difficulty">Difficulty level</Label>
              <Select
                value={selectedDifficulty}
                onValueChange={setSelectedDifficulty}
              >
                <SelectTrigger id="challenge-difficulty" className="w-full">
                  <SelectValue placeholder="Select difficulty" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
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
                  {timerActive ? "Running" : !hasStarted ? "Start" : "Resume"}
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
            <Link href="/practice/challenges/session">Begin challenge</Link>
          </Button>
        </CardFooter>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Past challenges</CardTitle>
            <CardDescription>Review your recent sessions</CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            <div className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
              <span className="font-medium">Algorithms Challenge</span>
              <Badge variant="secondary">Score 85</Badge>
            </div>
            <div className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
              <span className="font-medium">Data Structures Challenge</span>
              <Badge variant="secondary">Score 90</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Leaderboard</CardTitle>
              <CardDescription>Top performers this week</CardDescription>
            </div>
            <Trophy className="size-5 text-amber-500" />
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {leaderboard.map((entry) => (
                <li
                  key={entry.rank}
                  className="flex items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-muted/50"
                >
                  <span className="flex items-center gap-3">
                    <span className="inline-flex size-6 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                      {entry.rank}
                    </span>
                    {entry.name}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {entry.score}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Submit feedback</CardTitle>
          <CardDescription>
            Share your thoughts on the challenge experience
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            placeholder="What worked well, what could be better..."
            rows={4}
          />
          <Button variant="outline">Submit feedback</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Coding resources</CardTitle>
          <CardDescription>
            Helpful references to level up your practice
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          {[
            { label: "Coding tips", href: "#" },
            { label: "Practice problems", href: "/problems" },
            { label: "Tutorials", href: "#" },
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