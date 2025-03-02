import "./globals.css";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { ThemeProvider } from "next-themes";
import Sidebar from "@/components/sidebar";
import Footer from "@/app/(home)/_components/footer";
import { Toaster } from "sonner";

export const metadata = {
  title: "AI DB Search",
  description: "Chat with databases using natural language powered by the AI",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${GeistMono.className} ${GeistSans.className}`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <div className="flex">
            <Sidebar />
            <div className="flex-1 ml-64">
              <main className="container max-w-6xl px-8 py-0 mx-auto">
                {children}
              </main>
            </div>
          </div>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
