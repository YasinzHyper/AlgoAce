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
import { AuthProvider } from "@/contexts/auth-context"
// import { ThemeProvider } from "@/components/theme-provider"

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AlgoAce - DSA Preparation",
  description: "A platform for Data Structures and Algorithms preparation",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
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
    </html>
  );
}