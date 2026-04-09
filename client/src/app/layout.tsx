import type React from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/contexts/auth-context";
import { Separator } from "@/components/ui/separator";
import Script from "next/script";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AlgoAce — DSA Preparation",
  description: "A platform for Data Structures and Algorithms preparation",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script id="theme-script" strategy="beforeInteractive">
          {`
            (function() {
              const colorTheme = localStorage.getItem('colorTheme') || 'slate';
              document.documentElement.setAttribute('data-theme', colorTheme);
              const themeMode = localStorage.getItem('theme') || 'system';
              const isDark = themeMode === 'dark' || (themeMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
              document.documentElement.classList.toggle('dark', isDark);
            })();
          `}
        </Script>
      </head>
      <body className={`${inter.className} antialiased`}>
        <AuthProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <SidebarProvider>
              <AppSidebar />
              <SidebarInset className="overflow-x-hidden bg-muted/20">
                <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 lg:h-16 lg:px-6">
                  <SidebarTrigger className="-ml-1" />
                  <Separator orientation="vertical" className="h-5" />
                  <span className="text-sm font-medium text-muted-foreground">
                    AlgoAce
                  </span>
                </header>
                <main className="mx-auto w-full max-w-screen-2xl flex-1 overflow-x-hidden p-4 md:p-6 lg:p-8">
                  {children}
                </main>
              </SidebarInset>
            </SidebarProvider>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
