"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  History,
  Database,
  BotMessageSquare,
  LayoutDashboard,
  Moon,
  Sun,
} from "lucide-react";
import Logo from "./logo";
import { Button } from "./ui/button";
import { useTheme } from "next-themes";

export default function Sidebar() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch by only rendering theme-dependent content after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  const menuList = [
    {
      name: "Chat with DB",
      icon: BotMessageSquare,
      path: "/",
    },
    {
      name: "Query History",
      icon: History,
      path: "/history",
    },
    {
      name: "DB Connection",
      icon: Database,
      path: "/connection",
    },
    // {
    //   name: "Dashboard",
    //   icon: LayoutDashboard,
    //   path: "/dashboard",
    // },
  ];

  const path = usePathname();
  useEffect(() => {}, [path]);

  return (
    <div className="fixed top-0 left-0 flex flex-col w-72 h-screen border-r border-gray-200/60 shadow-lg bg-white/95 backdrop-blur-xl dark:bg-neutral-950/95 dark:border-neutral-800/60">
      {/* Header Section */}
      <div className="px-6 py-8 border-b border-gray-100 dark:border-neutral-800/50">
        <div className="flex items-center justify-center mb-4">
          <Logo />
        </div>
        <div className="text-center">
          <p className="text-md text-gray-500 dark:text-gray-400 font-medium">
            AI Database Assistant
          </p>
        </div>
      </div>

      {/* Navigation Section */}
      <div className="flex-1 px-4 py-6">
        <div className="mb-4">
          <h3 className="px-3 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
            Navigation
          </h3>
        </div>
        <nav className="space-y-3">
          {menuList.map((menu, index) => (
            <Link href={menu.path} key={index}>
              <div
                className={`flex items-center gap-4 mb-3 px-4 py-3.5 rounded-xl transition-all duration-300 group relative overflow-hidden ${
                  path === menu.path
                    ? "bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950/30 dark:via-indigo-950/30 dark:to-purple-950/30 text-blue-700 dark:text-blue-300 font-semibold shadow-md border border-blue-100/50 dark:border-blue-800/30"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-neutral-800/50 hover:text-gray-900 dark:hover:text-gray-200"
                }`}
              >
                {/* Active indicator line */}
                {path === menu.path && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500 via-indigo-500 to-purple-600 rounded-r-full"></div>
                )}

                {/* Background glow effect for active state */}
                {path === menu.path && (
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-400/5 to-purple-400/5 rounded-xl"></div>
                )}

                <div className="relative flex items-center gap-4 w-full">
                  <div className="relative">
                    <menu.icon
                      className={`w-5 h-5 transition-all duration-300 ${
                        path === menu.path
                          ? "text-blue-600 dark:text-blue-400 scale-110"
                          : "text-gray-500 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:scale-105"
                      }`}
                    />
                    {/* {path === menu.path && (
                      <div className="absolute -top-1 -right-1 w-2 h-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full animate-pulse shadow-sm"></div>
                    )} */}
                  </div>

                  <span
                    className={`text-sm font-medium transition-all duration-300 ${
                      path === menu.path
                        ? "text-blue-700 dark:text-blue-300"
                        : ""
                    }`}
                  >
                    {menu.name}
                  </span>

                  {/* Hover arrow indicator */}
                  <div
                    className={`ml-auto transition-all duration-300 ${
                      path === menu.path
                        ? "opacity-100 translate-x-0"
                        : "opacity-0 translate-x-2 group-hover:opacity-60 group-hover:translate-x-0"
                    }`}
                  >
                    <div className="w-1.5 h-1.5 bg-current rounded-full animate-pulse"></div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </nav>
      </div>
      {/* Footer Section */}
      <div className="px-4 py-4 border-t border-gray-100 dark:border-neutral-800/50 bg-gray-50/50 dark:bg-neutral-900/50">
        {/* Version info */}
        <div className="mb-3 px-3 py-2 rounded-lg bg-gradient-to-r from-gray-50 to-gray-100 dark:from-neutral-800/30 dark:to-neutral-700/30 border border-gray-200/50 dark:border-neutral-700/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
              Version 1.0
            </span>
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                Online
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-neutral-800/50 border border-gray-200/50 dark:border-neutral-700/50 shadow-sm">
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              Theme
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {mounted
                ? theme === "dark"
                  ? "Dark mode"
                  : "Light mode"
                : "Loading..."}
            </span>
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
            className="relative border-gray-200 rounded-xl h-10 w-10 dark:border-neutral-600 bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-slate-900 dark:to-slate-800 hover:from-yellow-100 hover:to-orange-100 dark:hover:from-slate-800 dark:hover:to-slate-700 transition-all duration-300 hover:scale-105 hover:shadow-md group overflow-hidden"
          >
            {/* Background glow effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-yellow-200/20 to-orange-200/20 dark:from-blue-500/10 dark:to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

            {mounted && (
              <>
                <Sun className="relative w-4 h-4 transition-all duration-300 scale-100 rotate-0 dark:-rotate-90 dark:scale-0 text-yellow-600 drop-shadow-sm" />
                <Moon className="absolute w-4 h-4 transition-all duration-300 scale-0 rotate-90 dark:rotate-0 dark:scale-100 text-slate-400 drop-shadow-sm" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
