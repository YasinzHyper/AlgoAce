'use client';

import { Inter } from "next/font/google";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/contexts/auth-context";

const inter = Inter({ subsets: ["latin"] });

export function BodyContent({ children }: { children: React.ReactNode }) {
  return (
    <body className={inter.className}>
      <AuthProvider>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
              <header className="flex h-14 items-center gap-4 border-b bg-background px-4 lg:h-16">
                <SidebarTrigger className="cursor-pointer" />
                <div className="flex-1" />
              </header>
              <main className="flex-1 p-4 md:p-6">{children}</main>
            </SidebarInset>
          </SidebarProvider>
        </ThemeProvider>
      </AuthProvider>
    </body>
  );
} 