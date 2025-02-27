"use client";

import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Moon, Sun } from "lucide-react";

export default function Header() {
  const { theme, setTheme } = useTheme();

  return (
    <header className="sticky top-0 z-10 w-full bg-white border-b border-gray-200 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center justify-between h-16 px-8">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-black dark:text-white">
            Welcome to DB Assistant
          </h2>
        </div>

        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            <Sun className="w-5 h-5 transition-all scale-100 rotate-0 dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute w-5 h-5 transition-all scale-0 rotate-90 dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
