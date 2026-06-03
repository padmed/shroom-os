// src/app/layout.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname(); // Live intercept engine for URL string routing mutations

  // Unified stylistic configuration handles to prevent massive redundant blocks of code
  const getNavStyle = (targetPath: string) => {
    const isActive = pathname === targetPath;
    return isActive
      ? "flex items-center space-x-3 px-3 py-2 rounded-lg bg-zinc-800 text-emerald-400 font-bold text-sm transition-all shadow-sm shadow-black/40 border border-zinc-700/50"
      : "flex items-center space-x-3 px-3 py-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50 font-medium text-sm transition-all";
  };

  const getMobileNavStyle = (targetPath: string) => {
    const isActive = pathname === targetPath;
    return isActive
      ? "flex flex-col items-center justify-center space-y-1 text-xs text-emerald-400 font-bold transition-all"
      : "flex flex-col items-center justify-center space-y-1 text-xs text-zinc-500 hover:text-zinc-300 transition-all";
  };

  return (
    <html lang="en" className="dark">
      <body
        className={`${geist.className} bg-zinc-950 text-zinc-50 antialiased`}
      >
        <div className="flex h-screen w-screen overflow-hidden flex-col md:flex-row">
          {/* 1. DESKTOP SIDEBAR PANEL */}
          <aside className="w-64 border-r border-zinc-800 bg-zinc-900/50 p-6 flex flex-col justify-between hidden md:flex">
            <div className="space-y-6">
              <div className="flex items-center space-x-2 px-2">
                <span className="text-xl">🍄</span>
                <span className="font-bold tracking-tight text-lg">
                  ShroomOS
                </span>
              </div>
              <nav className="space-y-1.5">
                <Link href="/" className={getNavStyle("/")}>
                  <span>📊</span> <span>Command Center</span>
                </Link>
                <Link href="/autopilot" className={getNavStyle("/autopilot")}>
                  <span>🚀</span> <span>Autopilot</span>
                </Link>
                <Link href="/logs" className={getNavStyle("/logs")}>
                  <span>⚠️</span> <span>Alarms & Logs</span>
                </Link>
              </nav>
            </div>
            <div className="px-3 py-2 text-xs text-zinc-600 font-mono">
              Status: Secure Gateway
            </div>
          </aside>

          {/* 2. MOBILE TOP BAR VIEWPORT HEADER */}
          <header className="w-full h-14 border-b border-zinc-800 bg-zinc-900/50 px-6 flex items-center justify-between md:hidden shrink-0">
            <div className="flex items-center space-x-2">
              <span className="text-lg">🍄</span>
              <span className="font-bold tracking-tight text-sm">ShroomOS</span>
            </div>
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </header>

          {/* 3. CENTRALISED APPLICATION GRAPH PANELS SCROLLPLANE */}
          <main className="flex-1 overflow-y-auto bg-zinc-950 p-6 md:p-10 pb-24 md:pb-10">
            {children}
          </main>

          {/* 4. MOBILE MOBILE TOUCH NAVIGATION PROFILE BAR */}
          <nav className="fixed bottom-0 left-0 right-0 h-16 border-t border-zinc-800 bg-zinc-900/90 backdrop-blur-md flex items-center justify-around px-4 md:hidden z-50 shadow-2xl shadow-black">
            <Link href="/" className={getMobileNavStyle("/")}>
              <span className="text-lg">📊</span>
              <span>Dashboard</span>
            </Link>
            <Link href="/autopilot" className={getMobileNavStyle("/autopilot")}>
              <span className="text-lg">🚀</span>
              <span>Autopilot</span>
            </Link>
            <Link href="/logs" className={getMobileNavStyle("/logs")}>
              <span className="text-lg">⚠️</span>
              <span>Logs</span>
            </Link>
          </nav>
        </div>
      </body>
    </html>
  );
}
