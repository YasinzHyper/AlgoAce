'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/layout/stat-card";
import { EmptyState } from "@/components/layout/empty-state";
import { useAnalytics } from "@/hooks/use-analytics";
import { BarChart3, CheckCircle2, Flame, ListChecks, TrendingUp, Trophy } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// Theme-aware chart palette driven by CSS variables
const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

const axisStyle = {
  fontSize: 12,
  fill: "var(--muted-foreground)",
};

const tooltipStyle = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  color: "var(--popover-foreground)",
};

export default function ProgressOverviewPage() {
  const { data, loading, error, refresh } = useAnalytics();

  if (loading) {
    return (
      <div className="space-y-8">
        <PageHeader
          title="Analytics"
          description="Track your problem-solving progress, streaks, and topic mastery."
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-[420px] w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-8">
        <PageHeader title="Analytics" />
        <EmptyState
          icon={BarChart3}
          title="Couldn't load analytics"
          description={error ?? "Something went wrong while fetching your progress."}
          action={
            <Button onClick={() => refresh()} variant="outline">
              Try again
            </Button>
          }
        />
      </div>
    );
  }

  const { totals, weekly_progress, topic_mastery, difficulty_distribution, recent_activity } = data;

  const hasAnyActivity = totals.problems_solved > 0 || totals.topics_completed > 0;
  const topTopics = topic_mastery.slice(0, 8);
  const hasDifficultyData = difficulty_distribution.some((d) => d.value > 0);

  const weekTrend =
    totals.solved_this_week > 0
      ? { value: `+${totals.solved_this_week} this week`, positive: true }
      : undefined;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Analytics"
        description="Track your problem-solving progress, streaks, and topic mastery."
      />

      <div className="grid gap-4 stagger-children sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Problems Solved"
          value={totals.problems_solved}
          icon={CheckCircle2}
          trend={weekTrend}
        />
        <StatCard
          title="Current Streak"
          value={`${totals.current_streak} ${totals.current_streak === 1 ? "day" : "days"}`}
          icon={Flame}
          sparkle={totals.current_streak > 0}
          description={
            totals.last_activity_date ? `last active ${totals.last_activity_date}` : "no activity yet"
          }
        />
        <StatCard
          title="Longest Streak"
          value={`${totals.longest_streak} ${totals.longest_streak === 1 ? "day" : "days"}`}
          icon={Trophy}
          description="personal best"
        />
        <StatCard
          title="Topics Completed"
          value={totals.topics_completed}
          icon={ListChecks}
          description="across all roadmaps"
        />
      </div>

      {!hasAnyActivity ? (
        <EmptyState
          icon={BarChart3}
          title="No activity yet"
          description="Mark problems as completed from your roadmap to start building your analytics."
          action={
            <Button asChild>
              <Link href="/problems">Go to problems</Link>
            </Button>
          }
        />
      ) : (
        <>
          <Tabs defaultValue="progress" className="space-y-4">
            <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
              <TabsTrigger value="progress" className="gap-1.5">
                <TrendingUp className="size-4" />
                <span className="hidden sm:inline">Progress</span>
              </TabsTrigger>
              <TabsTrigger value="topics">Topics</TabsTrigger>
              <TabsTrigger value="difficulty">Difficulty</TabsTrigger>
            </TabsList>

            <TabsContent value="progress">
              <Card>
                <CardHeader>
                  <CardTitle>Progress Over Time</CardTitle>
                  <CardDescription>
                    Problems solved per week and running total over the last 12 weeks
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[320px] sm:h-[380px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={weekly_progress}>
                        <defs>
                          <linearGradient id="problemsGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.4} />
                            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="cumulativeGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.4} />
                            <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                        <XAxis dataKey="label" tick={axisStyle} tickLine={false} axisLine={false} />
                        <YAxis yAxisId="left" tick={axisStyle} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
                        <YAxis yAxisId="right" orientation="right" tick={axisStyle} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Legend iconType="circle" />
                        <Area
                          yAxisId="left"
                          type="monotone"
                          dataKey="problems"
                          name="Solved This Week"
                          stroke="var(--chart-1)"
                          strokeWidth={2}
                          fill="url(#problemsGradient)"
                        />
                        <Area
                          yAxisId="right"
                          type="monotone"
                          dataKey="cumulative"
                          name="Total Solved"
                          stroke="var(--chart-2)"
                          strokeWidth={2}
                          fill="url(#cumulativeGradient)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="topics">
              <Card>
                <CardHeader>
                  <CardTitle>Topic Mastery</CardTitle>
                  <CardDescription>Problems solved per topic tag (top {topTopics.length})</CardDescription>
                </CardHeader>
                <CardContent>
                  {topTopics.length > 0 ? (
                    <div className="h-[320px] sm:h-[380px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={topTopics}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                          <XAxis
                            dataKey="name"
                            tick={axisStyle}
                            tickLine={false}
                            axisLine={false}
                            interval={0}
                            angle={-30}
                            textAnchor="end"
                            height={70}
                          />
                          <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
                          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--muted)" }} />
                          <Bar dataKey="value" name="Solved" radius={[6, 6, 0, 0]} fill="var(--primary)" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <EmptyState
                      icon={BarChart3}
                      title="No topic data yet"
                      description="Complete a few problems to see your strongest topics."
                      className="border-0 bg-transparent p-8"
                    />
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="difficulty">
              <Card>
                <CardHeader>
                  <CardTitle>Difficulty Distribution</CardTitle>
                  <CardDescription>Breakdown of solved problems by difficulty</CardDescription>
                </CardHeader>
                <CardContent>
                  {hasDifficultyData ? (
                    <div className="h-[320px] sm:h-[380px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={difficulty_distribution.filter((d) => d.value > 0)}
                            cx="50%"
                            cy="50%"
                            innerRadius={70}
                            outerRadius={120}
                            paddingAngle={4}
                            dataKey="value"
                            stroke="var(--background)"
                            strokeWidth={4}
                            labelLine={false}
                            label={({ name, percent }) =>
                              `${name} ${(percent * 100).toFixed(0)}%`
                            }
                          >
                            {difficulty_distribution
                              .filter((d) => d.value > 0)
                              .map((entry, index) => (
                                <Cell
                                  key={entry.name}
                                  fill={CHART_COLORS[index % CHART_COLORS.length]}
                                />
                              ))}
                          </Pie>
                          <Tooltip contentStyle={tooltipStyle} />
                          <Legend iconType="circle" />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <EmptyState
                      icon={BarChart3}
                      title="No difficulty data yet"
                      description="Solve an Easy, Medium, or Hard to populate this chart."
                      className="border-0 bg-transparent p-8"
                    />
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Your latest problem-solving sessions</CardDescription>
            </CardHeader>
            <CardContent className="divide-y">
              {recent_activity.length === 0 ? (
                <p className="py-4 text-sm text-muted-foreground">
                  Nothing recent — mark a problem complete to see it here.
                </p>
              ) : (
                recent_activity.map((item, idx) => (
                  <div
                    key={`${item.type}-${item.problem_id ?? item.title}-${idx}`}
                    className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {item.type === "problem" && item.problem_id ? (
                          <Link href={`/problems/${item.problem_id}`} className="hover:underline">
                            {item.title}
                          </Link>
                        ) : (
                          item.title
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {item.topic}
                        {item.difficulty ? ` · ${item.difficulty}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge
                        variant="default"
                        className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-400"
                      >
                        {item.type === "problem" ? "Solved" : "Topic"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(item.completed_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
