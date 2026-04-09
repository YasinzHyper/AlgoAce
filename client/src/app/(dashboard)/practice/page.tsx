'use client';

import Link from "next/link";
import {
  ArrowRight,
  Clock,
  Crown,
  Gauge,
  ListChecks,
  Target,
  Timer,
  Trophy,
  Video,
} from "lucide-react";
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
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/layout/stat-card";
import { Meteors } from "@/components/magicui/meteors";
import { Marquee } from "@/components/magicui/marquee";

const practiceModes = [
  {
    title: "Mock Interviews",
    description:
      "Simulate a real technical interview with live camera and timed prompts.",
    href: "/practice/mock-interviews",
    icon: Video,
    cta: "Start interview",
    badge: "Recommended",
  },
  {
    title: "Coding Challenges",
    description:
      "Sharpen your problem-solving with curated, timed challenges across difficulty levels.",
    href: "/practice/challenges",
    icon: Timer,
    cta: "Start challenge",
  },
];

const recommended = [
  { id: 1, title: "Merge Intervals", difficulty: "Medium", duration: "30 min" },
  { id: 2, title: "Valid Parentheses", difficulty: "Easy", duration: "15 min" },
];

const trendingTopics = [
  "Arrays", "Hash Map", "Two Pointers", "Sliding Window", "Binary Search",
  "Dynamic Programming", "Graphs", "Trees", "Heaps", "Backtracking", "Greedy",
];

const leaderboard = [
  { rank: 1, name: "Alice", score: 95 },
  { rank: 2, name: "Bob", score: 90 },
  { rank: 3, name: "You", score: 85, self: true },
];

export default function PracticeOverviewPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Practice"
        description="Sharpen your interview skills with mock sessions and timed challenges."
        actions={
          <Button asChild>
            <Link href="/practice/mock-interviews">
              Quick start <ArrowRight className="size-4" />
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 stagger-children md:grid-cols-2">
        {practiceModes.map((mode) => (
          <Card
            key={mode.title}
            className="group glide-border relative overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <Meteors number={10} />
            <CardHeader className="relative">
              <div className="flex items-start justify-between gap-4">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <mode.icon className="size-5" />
                </div>
                {mode.badge && <Badge variant="secondary">{mode.badge}</Badge>}
              </div>
              <CardTitle className="mt-4">{mode.title}</CardTitle>
              <CardDescription>{mode.description}</CardDescription>
            </CardHeader>
            <CardFooter className="relative">
              <Button asChild variant="outline" className="w-full sm:w-auto">
                <Link href={mode.href}>
                  {mode.cta} <ArrowRight className="size-4" />
                </Link>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Statistics</h2>
        <div className="grid gap-4 stagger-children sm:grid-cols-3">
          <StatCard title="Total Sessions" value={15} icon={ListChecks} description="all time" />
          <StatCard title="Avg. Duration" value="45 min" icon={Clock} description="per session" />
          <StatCard
            title="Success Rate"
            value="80%"
            icon={Gauge}
            sparkle
            trend={{ value: "+6%", positive: true }}
          />
        </div>
      </section>

      {/* Trending topics marquee */}
      <Card className="relative overflow-hidden border-dashed py-4">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-card to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-card to-transparent" />
        <Marquee pauseOnHover className="[--duration:35s]">
          {trendingTopics.map((topic) => (
            <Badge key={topic} variant="secondary" className="px-3 py-1 text-sm">
              {topic}
            </Badge>
          ))}
        </Marquee>
        <Marquee reverse pauseOnHover className="[--duration:30s]">
          {trendingTopics.map((topic) => (
            <Badge key={topic} variant="outline" className="px-3 py-1 text-sm">
              {topic}
            </Badge>
          ))}
        </Marquee>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recommended for you</CardTitle>
            <CardDescription>Based on your recent performance</CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            {recommended.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{c.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {c.difficulty} · {c.duration}
                  </p>
                </div>
                <Button asChild size="sm" variant="ghost">
                  <Link href={`/practice/challenges/${c.id}`}>
                    Start <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </div>
            ))}
          </CardContent>
          <CardFooter className="border-t">
            <Button asChild variant="link" className="px-0">
              <Link href="/practice/challenges">View all challenges</Link>
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Leaderboard</CardTitle>
              <CardDescription>This week&apos;s top performers</CardDescription>
            </div>
            <Trophy className="size-5 text-amber-500" />
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {leaderboard.map((entry) => (
                <li
                  key={entry.rank}
                  className={`flex items-center justify-between rounded-md px-3 py-2 text-sm ${
                    entry.self
                      ? "bg-primary/10 font-medium text-primary"
                      : "hover:bg-muted/50"
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <span className="inline-flex size-6 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                      {entry.rank}
                    </span>
                    {entry.name}
                    {entry.rank === 1 && <Crown className="size-3.5 text-amber-500" />}
                  </span>
                  <span className="tabular-nums text-muted-foreground">{entry.score}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card className="border-dashed">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Weekly goals</CardTitle>
            <CardDescription>Define targets to stay on track</CardDescription>
          </div>
          <Target className="size-5 text-muted-foreground" />
        </CardHeader>
        <CardFooter>
          <Button variant="outline">Set goals</Button>
        </CardFooter>
      </Card>
    </div>
  );
}