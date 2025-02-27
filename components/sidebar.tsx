"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import {
  History,
  Database,
  BotMessageSquare,
  LayoutDashboard,
} from "lucide-react";
import Logo from "./logo";
export default function Sidebar() {
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
    {
      name: "Dashboard",
      icon: LayoutDashboard,
      path: "/dashboard",
    },
  ];

  const path = usePathname();
  useEffect(() => {}, [path]);

  return (
    <div className="fixed top-0 left-0 w-64 h-screen border-r border-gray-200 bg-gray-50 dark:bg-neutral-950 dark:border-neutral-800">
      <div className="px-4 py-6">
        <Logo />
        <nav className="mt-12">
          {menuList.map((menu, index) => (
            <Link href={menu.path} key={index}>
              <div
                key={index}
                className={`flex gap-2 mb-2 p-3 hover:bg-secondary hover:text-primary rounded-lg cursor-pointer items-center ${
                  path === menu.path && "bg-secondary text-primary"
                }`}
              >
                <menu.icon className="w-6 h-6" />
                <h2 className="text-md">{menu.name}</h2>
              </div>
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
