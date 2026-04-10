'use client';

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Flame,
  Gauge,
  ListChecks,
  Loader2,
  Sparkles,
  Target,
  Timer,
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
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/layout/stat-card";
import { Meteors } from "@/components/magicui/meteors";
import { Marquee } from "@/components/magicui/marquee";
import { LeaderboardCard } from "@/components/practice/leaderboard-card";
import { useAnalytics } from "@/hooks/use-analytics";
import { useChallenges } from "@/hooks/use-challenges";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

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
      "Timed problem sets generated from your roadmap's weak spots — earn points for the leaderboard.",
    href: "/practice/challenges",
    icon: Timer,
    cta: "Start challenge",
  },
];

export default function PracticeOverviewPage() {
  const router = useRouter();
  const { data: analytics, loading: analyticsLoading } = useAnalytics();
  const { recommendation, generating, generate } = useChallenges();

  const totals = analytics?.totals;
  const topTopics = (analytics?.topic_mastery ?? []).slice(0, 12).map((t) => t.name);
  const marqueeTopics = topTopics.length >= 4 ? topTopics : [
    "Arrays", "Hash Map", "Two Pointers", "Sliding Window", "Binary Search",
    "Dynamic Programming", "Graphs", "Trees", "Heaps", "Backtracking", "Greedy",
  ];

  const handleStartRecommended = async () => {
    if (!recommendation) {
      router.push("/practice/challenges");
      return;
    }
    try {
      const challenge = await generate({
        roadmap_id: recommendation.roadmap_id,
        difficulty: recommendation.difficulty,
        duration_minutes: recommendation.duration_minutes,
        problem_count: recommendation.problem_count,
        focus_topics: recommendation.focus_topics,
      });
      router.push(`/practice/challenges/${challenge.id}`);
    } catch (e) {
      toast.error("Couldn't start challenge", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Practice"
        description="Sharpen your interview skills with mock sessions and timed challenges."
        actions={
          <Button asChild>
            <Link href="/practice/challenges">
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
        <h2 className="text-lg font-semibold tracking-tight">Your stats</h2>
        {analyticsLoading ? (
          <div className="grid gap-4 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 w-full rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 stagger-children sm:grid-cols-3">
            <StatCard
              title="Problems Solved"
              value={totals?.problems_solved ?? 0}
              icon={CheckCircle2}
              trend={
                totals && totals.solved_this_week > 0
                  ? { value: `+${totals.solved_this_week} this week`, positive: true }
                  : undefined
              }
            />
            <StatCard
              title="Current Streak"
              value={`${totals?.current_streak ?? 0} ${totals?.current_streak === 1 ? "day" : "days"}`}
              icon={Flame}
              sparkle={(totals?.current_streak ?? 0) > 0}
              description={`best ${totals?.longest_streak ?? 0}`}
            />
            <StatCard
              title="Topics Covered"
              value={analytics?.topic_mastery.length ?? 0}
              icon={ListChecks}
              description="distinct tags"
            />
          </div>
        )}
      </section>

      {/* Trending topics marquee — driven by the user's own topic_mastery */}
      <Card className="relative overflow-hidden border-dashed py-4">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-card to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-card to-transparent" />
        <Marquee pauseOnHover className="[--duration:35s]">
          {marqueeTopics.map((topic) => (
            <Badge key={topic} variant="secondary" className="px-3 py-1 text-sm">
              {topic}
            </Badge>
          ))}
        </Marquee>
        <Marquee reverse pauseOnHover className="[--duration:30s]">
          {marqueeTopics.map((topic) => (
            <Badge key={topic} variant="outline" className="px-3 py-1 text-sm">
              {topic}
            </Badge>
          ))}
        </Marquee>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-5 text-primary" />
              Recommended challenge
            </CardTitle>
            <CardDescription>
              Generated from your roadmap progress and weakest topics.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recommendation ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="gap-1">
                    <Gauge className="size-3" />
                    {recommendation.difficulty}
                  </Badge>
                  <Badge variant="outline" className="gap-1">
                    <Timer className="size-3" />
                    {recommendation.duration_minutes} min
                  </Badge>
                  <Badge variant="outline">{recommendation.problem_count} problems</Badge>
                </div>
                {recommendation.focus_topics.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Focus topics
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {recommendation.focus_topics.map((t) => (
                        <Badge key={t} variant="secondary">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                <p className="text-sm text-muted-foreground">{recommendation.reason}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Create a roadmap to get a tailored challenge — or head to the
                Challenges page to start a custom one.
              </p>
            )}
          </CardContent>
          <CardFooter className="gap-2 border-t">
            <Button onClick={handleStartRecommended} disabled={generating}>
              {generating ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Starting...
                </>
              ) : (
                <>
                  <Target className="size-4" />
                  {recommendation ? "Start this challenge" : "Open challenges"}
                </>
              )}
            </Button>
            <Button asChild variant="ghost">
              <Link href="/practice/challenges">Customize</Link>
            </Button>
          </CardFooter>
        </Card>

        <LeaderboardCard defaultPeriod="week" limit={5} />
      </div>
    </div>
  );
}
