"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Moon, Sun, Monitor } from "lucide-react"

// Define types for theme options
type ThemeMode = "light" | "dark" | "system"
type ColorTheme = "slate" | "red" | "orange" | "green" | "blue" | "yellow" | "violet"
type Radius = "0.5rem" | "0.625rem" | "0.75rem" | "1rem"

// Helper functions to get initial values from localStorage
const getInitialThemeMode = (): ThemeMode => {
  if (typeof window === "undefined") return "system"
  return (localStorage.getItem("theme") as ThemeMode) || "system"
}

const getInitialColorTheme = (): ColorTheme => {
  if (typeof window === "undefined") return "slate"
  return (localStorage.getItem("colorTheme") as ColorTheme) || "slate"
}

const getInitialRadius = (): Radius => {
  if (typeof window === "undefined") return "0.625rem"
  return (localStorage.getItem("radius") as Radius) || "0.625rem"
}

export default function SettingsPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [themeMode, setThemeMode] = useState<ThemeMode>(getInitialThemeMode)
  const [colorTheme, setColorTheme] = useState<ColorTheme>(getInitialColorTheme)
  const [radius, setRadius] = useState<Radius>(getInitialRadius)

  // Apply theme changes
  useEffect(() => {
    const root = document.documentElement

    // Set the color theme
    root.setAttribute("data-theme", colorTheme)

    // Apply theme mode (light/dark/system)
    if (themeMode === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
      root.classList.toggle("dark", systemTheme === "dark")
    } else {
      root.classList.toggle("dark", themeMode === "dark")
    }

    // Apply border radius
    root.style.setProperty("--radius", radius)

    // Save preferences to localStorage
    localStorage.setItem("theme", themeMode)
    localStorage.setItem("colorTheme", colorTheme)
    localStorage.setItem("radius", radius)

    setIsLoading(false)
  }, [themeMode, colorTheme, radius])

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")

    const handleChange = () => {
      if (themeMode === "system") {
        const root = document.documentElement
        root.classList.toggle("dark", mediaQuery.matches)
      }
    }

    mediaQuery.addEventListener("change", handleChange)
    return () => mediaQuery.removeEventListener("change", handleChange)
  }, [themeMode])

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="h-[400px] bg-muted rounded" />
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">Settings</h1>

      <Tabs defaultValue="appearance" className="space-y-4">
        <TabsList>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
        </TabsList>

        <TabsContent value="appearance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Theme</CardTitle>
              <CardDescription>
                Customize how AlgoAce looks on your device
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Theme Mode Selection */}
              <div className="space-y-4">
                <Label>Mode</Label>
                <div className="flex items-center space-x-4">
                  <Button
                    variant={themeMode === "light" ? "default" : "outline"}
                    onClick={() => setThemeMode("light")}
                    className="flex items-center gap-2"
                  >
                    <Sun className="h-4 w-4" />
                    Light
                  </Button>
                  <Button
                    variant={themeMode === "dark" ? "default" : "outline"}
                    onClick={() => setThemeMode("dark")}
                    className="flex items-center gap-2"
                  >
                    <Moon className="h-4 w-4" />
                    Dark
                  </Button>
                  <Button
                    variant={themeMode === "system" ? "default" : "outline"}
                    onClick={() => setThemeMode("system")}
                    className="flex items-center gap-2"
                  >
                    <Monitor className="h-4 w-4" />
                    System
                  </Button>
                </div>
              </div>

              {/* Color Theme Selection */}
              <div className="space-y-4">
                <Label>Color Theme</Label>
                <div className="flex items-center space-x-4 flex-wrap gap-y-4">
                  {(["slate", "red", "orange", "green", "blue", "yellow", "violet"] as ColorTheme[]).map((theme) => (
                    <Button
                      key={theme}
                      variant={colorTheme === theme ? "default" : "outline"}
                      onClick={() => setColorTheme(theme)}
                    >
                      {theme.charAt(0).toUpperCase() + theme.slice(1)}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Border Radius Selection */}
              <div className="space-y-4">
                <Label>Border Radius</Label>
                <Select value={radius} onValueChange={(value) => setRadius(value as Radius)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select radius" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0.5rem">Small</SelectItem>
                    <SelectItem value="0.625rem">Default</SelectItem>
                    <SelectItem value="0.75rem">Large</SelectItem>
                    <SelectItem value="1rem">Extra Large</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>
                Configure how you receive notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive email notifications about your progress
                  </p>
                </div>
                <Switch />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Push Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive push notifications in your browser
                  </p>
                </div>
                <Switch />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="account">
          <Card>
            <CardHeader>
              <CardTitle>Account Settings</CardTitle>
              <CardDescription>
                Manage your account preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Account settings will be implemented in a future update.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}