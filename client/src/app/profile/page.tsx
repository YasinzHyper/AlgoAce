"use client";

import { useAuth } from "@/contexts/auth-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Trophy, Target, Clock, BookOpen, Code2, Camera, Image as ImageIcon, Trash2 } from "lucide-react";
import { ActivityCalendar } from "react-activity-calendar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/layout/stat-card";
import { PageHeader } from "@/components/layout/page-header";

// Generate a year of mock activity data (GitHub-style contribution graph)
function generateActivityData() {
  const end = new Date();
  const start = new Date();
  start.setFullYear(end.getFullYear() - 1);
  start.setDate(start.getDate() + 1);
  const days = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const rand = Math.random();
    const count = rand < 0.55 ? 0 : rand < 0.75 ? 1 : rand < 0.88 ? 2 : rand < 0.96 ? 3 : 5;
    days.push({
      date: d.toISOString().slice(0, 10),
      count,
      level: count === 0 ? 0 : Math.min(4, count),
    });
  }
  return days;
}

export default function ProfilePage() {
  const { user, loading } = useAuth();
  const { resolvedTheme } = useTheme();
  const activityData = useMemo(generateActivityData, []);
  const totalContributions = useMemo(
    () => activityData.reduce((sum, d) => sum + d.count, 0),
    [activityData]
  );
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [pendingPhoto, setPendingPhoto] = useState<string | null>(null);
  const [isPreviewOnly, setIsPreviewOnly] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load photo from localStorage on mount
  useEffect(() => {
    const savedPhoto = typeof window !== 'undefined' ? localStorage.getItem('profilePhoto') : null;
    if (savedPhoto) setPhotoPreview(savedPhoto);
  }, []);

  // Open webcam modal
  const handleTakePhoto = async () => {
    setShowPhotoModal(true);
    setPendingPhoto(null);
    setTimeout(async () => {
      if (videoRef.current) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          videoRef.current.srcObject = stream;
        } catch (err) {
          alert('Unable to access camera.');
          setShowPhotoModal(false);
        }
      }
    }, 100);
  };

  // Capture photo from webcam (set as pending)
  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/png');
        setPendingPhoto(dataUrl);
        // Stop camera
        if (video.srcObject) {
          (video.srcObject as MediaStream).getTracks().forEach(track => track.stop());
        }
      }
    }
  };

  // Update photoPreview and save to localStorage
  const setAndSavePhoto = (dataUrl: string) => {
    setPhotoPreview(dataUrl);
    if (typeof window !== 'undefined') {
      localStorage.setItem('profilePhoto', dataUrl);
    }
  };

  // Upload from gallery (set as pending)
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPendingPhoto(ev.target?.result as string);
        setIsPreviewOnly(false); // Ensure Save/Discard modal for gallery upload
        setShowPhotoModal(true);
      };
      reader.readAsDataURL(file);
    }
  };

  // Save/discard handlers
  const handleSavePhoto = () => {
    if (pendingPhoto) {
      setAndSavePhoto(pendingPhoto);
      setPendingPhoto(null);
      setShowPhotoModal(false);
    }
  };
  const handleDiscardPhoto = () => {
    setPendingPhoto(null);
    setShowPhotoModal(false);
  };

  // Discard existing saved photo
  const handleDiscardExistingPhoto = () => {
    setPhotoPreview(null);
    setPendingPhoto(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('profilePhoto');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-40" />
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Skeleton className="h-20 w-20 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-48" />
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Not Signed In</CardTitle>
            <CardDescription>Please sign in to view your profile</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const currentPhoto = pendingPhoto || photoPreview || user.user_metadata?.avatar_url;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Profile"
        description="Your account, progress, and achievements in one place."
      />

      {/* Profile Header Card */}
      <Card className="animate-fade-in-up">
        <CardContent>
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <Avatar
              className="size-20 cursor-pointer ring-2 ring-border ring-offset-2 ring-offset-background transition-all hover:ring-primary/60"
              onClick={() => {
                if (currentPhoto) {
                  setPendingPhoto(currentPhoto);
                  setIsPreviewOnly(true);
                  setShowPhotoModal(true);
                }
              }}
            >
              <AvatarImage src={currentPhoto} alt={user.email} />
              <AvatarFallback className="text-xl">{user.email?.[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="space-y-0.5">
                <h3 className="truncate text-lg font-semibold leading-tight">{user.email}</h3>
                <p className="text-sm text-muted-foreground">
                  Member since {new Date(user.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={handleTakePhoto}>
                  <Camera className="size-4" />
                  Take photo
                </Button>
                <Button size="sm" variant="outline" onClick={handleUploadClick}>
                  <ImageIcon className="size-4" />
                  Upload
                </Button>
                {(photoPreview || pendingPhoto) && (
                  <Button size="sm" variant="ghost" onClick={handleDiscardExistingPhoto} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="size-4" />
                    Remove
                  </Button>
                )}
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Photo capture / upload dialog */}
      <Dialog
        open={showPhotoModal && !isPreviewOnly}
        onOpenChange={(open) => {
          if (!open) {
            if (videoRef.current && videoRef.current.srcObject) {
              (videoRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
            }
            setShowPhotoModal(false);
            setPendingPhoto(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pendingPhoto ? "Confirm photo" : "Take a photo"}</DialogTitle>
          </DialogHeader>
          {!pendingPhoto ? (
            <>
              <video
                ref={videoRef}
                autoPlay
                muted
                className="aspect-video w-full rounded-lg border bg-muted object-cover"
              />
              <canvas ref={canvasRef} className="hidden" />
              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  if (videoRef.current && videoRef.current.srcObject) {
                    (videoRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
                  }
                  setShowPhotoModal(false);
                }}>Cancel</Button>
                <Button onClick={handleCapture}>
                  <Camera className="size-4" />
                  Capture
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <img
                src={pendingPhoto}
                alt="Preview"
                className="aspect-video w-full rounded-lg border object-cover"
              />
              <DialogFooter>
                <Button variant="outline" onClick={handleDiscardPhoto}>Discard</Button>
                <Button onClick={handleSavePhoto}>Save photo</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Preview-only dialog */}
      <Dialog
        open={showPhotoModal && isPreviewOnly}
        onOpenChange={(open) => {
          if (!open) {
            setShowPhotoModal(false);
            setIsPreviewOnly(false);
            setPendingPhoto(null);
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Profile photo</DialogTitle>
          </DialogHeader>
          <img
            src={pendingPhoto ?? undefined}
            alt="Profile"
            className="max-h-[70vh] w-full rounded-lg object-contain"
          />
        </DialogContent>
      </Dialog>

      {/* Stats Overview */}
      <div className="grid gap-4 stagger-children sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          title="Problems Solved"
          value={24}
          icon={Trophy}
          sparkle
          trend={{ value: "+3 this week", positive: true }}
        />
        <StatCard
          title="Current Streak"
          value="5 days"
          icon={Target}
          sparkle
          description="vs 4 last week"
        />
        <StatCard
          title="Total Time"
          value="12h 30m"
          icon={Clock}
          description="all time"
        />
      </div>

      {/* Detailed Progress */}
      <Card>
        <CardHeader>
          <CardTitle>Learning Progress</CardTitle>
          <CardDescription>Your journey through different topics</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="topics" className="w-full">
            <TabsList>
              <TabsTrigger value="topics">Topics</TabsTrigger>
              <TabsTrigger value="difficulty">Difficulty</TabsTrigger>
            </TabsList>
            <TabsContent value="topics" className="space-y-4">
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium">Arrays & Strings</span>
                    <span className="text-sm text-muted-foreground">75%</span>
                  </div>
                  <Progress value={75} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium">Linked Lists</span>
                    <span className="text-sm text-muted-foreground">45%</span>
                  </div>
                  <Progress value={45} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium">Trees & Graphs</span>
                    <span className="text-sm text-muted-foreground">30%</span>
                  </div>
                  <Progress value={30} className="h-2" />
                </div>
              </div>
            </TabsContent>
            <TabsContent value="difficulty" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">Easy</Badge>
                      <div>
                        <p className="text-sm font-medium">Completed</p>
                        <p className="text-2xl font-bold">15</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">Medium</Badge>
                      <div>
                        <p className="text-sm font-medium">Completed</p>
                        <p className="text-2xl font-bold">7</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">Hard</Badge>
                      <div>
                        <p className="text-sm font-medium">Completed</p>
                        <p className="text-2xl font-bold">2</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Your latest learning milestones</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-blue-100 rounded-full">
                <Code2 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium">Solved "Two Sum" Problem</p>
                <p className="text-sm text-muted-foreground">2 hours ago</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="p-2 bg-green-100 rounded-full">
                <BookOpen className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="font-medium">Completed Linked Lists Module</p>
                <p className="text-sm text-muted-foreground">1 day ago</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="p-2 bg-purple-100 rounded-full">
                <Trophy className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="font-medium">Achieved 5-day Streak</p>
                <p className="text-sm text-muted-foreground">2 days ago</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contribution Graph (GitHub-style) */}
      <Card>
        <CardHeader>
          <CardTitle>{totalContributions} contributions in the last year</CardTitle>
          <CardDescription>Problems solved per day</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <ActivityCalendar
            data={activityData}
            blockSize={11}
            blockMargin={3}
            blockRadius={2}
            fontSize={11}
            maxLevel={4}
            colorScheme={resolvedTheme === "dark" ? "dark" : "light"}
            theme={{
              light: ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"],
              dark: ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"],
            }}
            labels={{
              legend: { less: "Less", more: "More" },
              totalCount: "{{count}} contributions in the last year",
            }}
            showWeekdayLabels
            hideTotalCount
            renderBlock={(block, activity) => (
              <Tooltip>
                <TooltipTrigger asChild>{block}</TooltipTrigger>
                <TooltipContent>
                  {activity.count === 0 ? "No" : activity.count}{" "}
                  {activity.count === 1 ? "contribution" : "contributions"} on{" "}
                  {new Date(activity.date).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </TooltipContent>
              </Tooltip>
            )}
          />
        </CardContent>
      </Card>

      {/* Weekly Goals */}
      <Card>
        <CardHeader>
          <CardTitle>Weekly Goals</CardTitle>
          <CardDescription>Stay focused and hit your targets</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium">Problems to Solve</span>
                <span className="text-sm text-muted-foreground">3 / 5</span>
              </div>
              <Progress value={(3 / 5) * 100} />
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium">Hours to Study</span>
                <span className="text-sm text-muted-foreground">6 / 10</span>
              </div>
              <Progress value={(6 / 10) * 100} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Achievements */}
      <Card>
        <CardHeader>
          <CardTitle>Achievements</CardTitle>
          <CardDescription>Milestones you’ve unlocked</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="flex items-center space-x-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              <span>10 Problems Solved</span>
            </div>
            <div className="flex items-center space-x-2">
              <Target className="h-5 w-5 text-blue-500" />
              <span>5-Day Streak</span>
            </div>
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-green-500" />
              <span>10 Hours Logged</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* XP / Level System */}
      <Card>
        <CardHeader>
          <CardTitle>Experience</CardTitle>
          <CardDescription>Gamify your growth</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p>Level 2</p>
            <Progress value={40} />
            <p className="text-sm text-muted-foreground">40 XP / 100 XP to next level</p>
          </div>
        </CardContent>
      </Card>

      {/* Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle>Leaderboard</CardTitle>
          <CardDescription>See where you rank</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            <li className="flex justify-between">
              <span>🥇 Alice</span>
              <span>120 XP</span>
            </li>
            <li className="flex justify-between">
              <span>🥈 Bob</span>
              <span>100 XP</span>
            </li>
            <li className="flex justify-between font-semibold">
              <span>🥉 You</span>
              <span>90 XP</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
