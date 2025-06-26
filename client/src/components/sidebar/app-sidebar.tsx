"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { BarChart3, Code2, Home, LogOut, Map, Settings, Target, User } from "lucide-react"
import { logout } from "@/app/login/actions"
import { useEffect, useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { Skeleton } from "@/components/ui/skeleton"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

const SIDEBAR_WIDTH = "16em"
const SIDEBAR_WIDTH_MOBILE = "12rem"

// Navigation items for the sidebar
const navigationItems = [
  {
    title: "Home",
    icon: Home,
    href: "/",

  },
  {
    title: "Roadmap",
    icon: Map,
    href: "/roadmap",

  },
  {
    title: "Problems",
    icon: Code2,
    href: "/problems",

  },
  {
    title: "Analytics",
    icon: BarChart3,
    href: "/analytics",

  },
  {
    title: "Practice",
    icon: Target,
    href: "/practice",

  },
]

export function AppSidebar() {

  const pathname = usePathname()
  const { user, loading, refresh } = useAuth();
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setProfilePhoto(localStorage.getItem('profilePhoto'));
    }
  }, [user]);

  useEffect(() => {
    // console.log("Sidebar auth state:", { user, loading })
  }, [user, loading])

  const handleLogout = async () => {
    try {
      await logout()
      await refresh() // Force refresh the auth state
    } catch (error) {
      console.error("Error logging out:", error)
    }
  }

  // Refresh auth state when pathname changes (e.g., after login/logout)
  useEffect(() => {
    refresh()
  }, [pathname, refresh])

  // Extract the footer content logic to a variable to avoid nested ternary
  let sidebarFooterContent: React.ReactNode;
  if (loading) {
    sidebarFooterContent = (
      <SidebarMenuButton size="lg" className="cursor-pointer">
        <Skeleton className="h-6 w-6 rounded-full" />
        <Skeleton className="h-4 w-24" />
      </SidebarMenuButton>
    );
  } else if (user) {
    sidebarFooterContent = (
      <DropdownMenu>
        <DropdownMenuTrigger className="cursor-pointer" asChild>
          <SidebarMenuButton size="lg" className="cursor-pointer">
            <Avatar className="h-6 w-6">
              <AvatarImage src={profilePhoto ?? user.user_metadata?.avatar_url} alt={user.email} />
              <AvatarFallback>{user.email?.[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col items-start">
              <span className="text-sm font-medium">{user.email}</span>
              <span className="text-xs text-muted-foreground">Signed in</span>
            </div>
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem asChild className="cursor-pointer">
            <Link href="/profile" className="flex items-center">
              <User className="mr-2 h-4 w-4" />
              <span>View Profile</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="cursor-pointer">
            <Link href="/settings" className="flex items-center">
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="flex items-center text-destructive focus:text-destructive cursor-pointer"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            <span>Log out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  } else {
    sidebarFooterContent = (
      <SidebarMenuButton size="lg" asChild>
        <Link href="/login" className="flex items-center">
          <Avatar className="h-6 w-6">
            <AvatarFallback>?</AvatarFallback>
          </Avatar>
          <span>Sign in</span>
        </Link>
      </SidebarMenuButton>
    );
  }

  return (
    <Sidebar variant="floating" collapsible="icon">
      <SidebarHeader className="py-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg">
              <a href="/" >
                <div className="flex aspect-square  h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <Code2 className="size-4" />
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="text-lg font-bold">AlgoAce</span>
                  <span className="text-xs text-muted-foreground">DSA Preparation</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={pathname === item.href} tooltip={item.title}>
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            {sidebarFooterContent}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}