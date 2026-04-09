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
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/layout/stat-card";
import { CheckCircle2, Clock, Flame, Gauge, TrendingUp } from "lucide-react";
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

const progressData = [
  { date: "Week 1", problems: 5, score: 65 },
  { date: "Week 2", problems: 8, score: 70 },
  { date: "Week 3", problems: 12, score: 75 },
  { date: "Week 4", problems: 15, score: 80 },
  { date: "Week 5", problems: 20, score: 85 },
];

const topicData = [
  { name: "Arrays", value: 90 },
  { name: "Strings", value: 85 },
  { name: "DP", value: 70 },
  { name: "Graphs", value: 65 },
  { name: "Trees", value: 75 },
];

const difficultyData = [
  { name: "Easy", value: 20 },
  { name: "Medium", value: 15 },
  { name: "Hard", value: 7 },
];

const recentActivity = [
  { title: "Two Sum", topic: "Arrays", difficulty: "Easy", status: "Solved", time: "2h ago" },
  { title: "LRU Cache", topic: "Design", difficulty: "Medium", status: "Solved", time: "1d ago" },
  { title: "Word Ladder", topic: "Graphs", difficulty: "Hard", status: "Attempted", time: "2d ago" },
];

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
  return (
    <div className="space-y-8">
      <PageHeader
        title="Analytics"
        description="Track your problem-solving progress, streaks, and topic mastery."
      />

      <div className="grid gap-4 stagger-children sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Problems Solved"
          value={42}
          icon={CheckCircle2}
          trend={{ value: "+8 this week", positive: true }}
        />
        <StatCard
          title="Current Streak"
          value="7 days"
          icon={Flame}
          sparkle
          trend={{ value: "+2", positive: true }}
          description="vs last week"
        />
        <StatCard
          title="Average Score"
          value="85%"
          icon={Gauge}
          trend={{ value: "+5%", positive: true }}
          description="last 30 days"
        />
        <StatCard
          title="Time Spent"
          value="120h"
          icon={Clock}
          description="total"
        />
      </div>

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
                Problems solved and average score per week
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[320px] sm:h-[380px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={progressData}>
                    <defs>
                      <linearGradient id="problemsGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="date" tick={axisStyle} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="left" tick={axisStyle} tickLine={false} axisLine={false} width={32} />
                    <YAxis yAxisId="right" orientation="right" tick={axisStyle} tickLine={false} axisLine={false} width={32} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend iconType="circle" />
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="problems"
                      name="Problems Solved"
                      stroke="var(--chart-1)"
                      strokeWidth={2}
                      fill="url(#problemsGradient)"
                    />
                    <Area
                      yAxisId="right"
                      type="monotone"
                      dataKey="score"
                      name="Avg Score"
                      stroke="var(--chart-2)"
                      strokeWidth={2}
                      fill="url(#scoreGradient)"
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
              <CardDescription>Your proficiency across data-structure topics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[320px] sm:h-[380px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topicData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="name" tick={axisStyle} tickLine={false} axisLine={false} />
                    <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={32} unit="%" />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--muted)" }} />
                    <Bar dataKey="value" name="Mastery" radius={[6, 6, 0, 0]} fill="var(--primary)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
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
              <div className="h-[320px] sm:h-[380px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={difficultyData}
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
                      {difficultyData.map((entry, index) => (
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
          {recentActivity.map((item) => (
            <div
              key={item.title}
              className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{item.title}</p>
                <p className="text-sm text-muted-foreground">
                  {item.topic} · {item.difficulty}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Badge
                  variant={item.status === "Solved" ? "default" : "secondary"}
                  className={
                    item.status === "Solved"
                      ? "bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-400"
                      : ""
                  }
                >
                  {item.status}
                </Badge>
                <span className="text-xs text-muted-foreground">{item.time}</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}