"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
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
    <div className="fixed top-0 left-0 flex flex-col w-64 h-screen border-r border-gray-200 shadow-sm bg-gray-50 dark:bg-neutral-950 dark:border-neutral-800">
      <div className="flex-1 px-6 py-8">
        <div className="flex items-center justify-center">
          <Logo />
        </div>
        <nav className="mt-10 space-y-1.5">
          {menuList.map((menu, index) => (
            <Link href={menu.path} key={index}>
              <div
                className={`flex items-center gap-3 px-4 py-3 my-1 rounded-lg transition-all duration-200 group relative ${
                  path === menu.path
                    ? "bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 text-primary font-medium shadow-sm"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-200/70 dark:hover:bg-neutral-800/70"
                }`}
              >
                <div className="relative">
                  <menu.icon
                    className={`w-5 h-5 transition-all duration-200 ${
                      path === menu.path
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-gray-500 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400"
                    }`}
                  />
                  {path === menu.path && (
                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full animate-pulse"></div>
                  )}
                </div>
                <span className="text-sm font-medium">{menu.name}</span>
                {path === menu.path && (
                  <div className="w-1 h-8 bg-gradient-to-b from-blue-500 to-purple-600 rounded-full absolute -left-0.5"></div>
                )}
              </div>
            </Link>
          ))}
        </nav>
      </div>
      <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-neutral-800">
        <div className="text-sm text-gray-500 dark:text-gray-400">
          <span>Update the theme</span>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label="Toggle theme"
          className="border-gray-200 rounded-full h-9 w-9 dark:border-neutral-700 bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-slate-900 dark:to-slate-800 hover:from-yellow-100 hover:to-orange-100 dark:hover:from-slate-800 dark:hover:to-slate-700 transition-all duration-200"
        >
          <Sun className="w-4 h-4 transition-all scale-100 rotate-0 dark:-rotate-90 dark:scale-0 text-yellow-600" />
          <Moon className="absolute w-4 h-4 transition-all scale-0 rotate-90 dark:rotate-0 dark:scale-100 text-slate-400" />
        </Button>
      </div>
    </div>
  );
}
