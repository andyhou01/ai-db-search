import Link from "next/link";
import Image from "next/image";
import { useTheme } from "next-themes";

const Logo = () => {
  const { theme } = useTheme();

  return (
    <Link href={"/"} className="flex items-center justify-center gap-4 group">
      <div className="relative">
        {theme === "light" ? (
          <Image
            src="/logo.svg"
            alt="logo"
            width={60}
            height={42}
            className="drop-shadow-lg hover:drop-shadow-xl transition-all duration-300"
          />
        ) : (
          <Image
            src="/logo-white.svg"
            alt="logo"
            width={60}
            height={42}
            className="drop-shadow-[0_0_10px_rgba(59,130,246,0.5)] hover:drop-shadow-[0_0_15px_rgba(59,130,246,0.7)] transition-all duration-300"
          />
        )}
      </div>
      <span className="text-2xl font-bold relative">
        {theme === "light" ? (
          <span className="bg-gradient-to-b from-blue-500 via-blue-600 to-blue-700 bg-clip-text text-transparent transition-all duration-300 [text-shadow:0_1px_2px_rgba(0,0,0,0.2)]">
            DB Chat
          </span>
        ) : (
          <span className="bg-gradient-to-b from-slate-300 via-gray-400 to-slate-600 bg-clip-text text-transparent transition-all duration-300 [text-shadow:0_1px_1px_rgba(255,255,255,0.1)]">
            DB Chat
          </span>
        )}
        <span className="absolute -inset-1 bg-blue-500/20 dark:bg-blue-400/20 rounded-lg blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
      </span>
    </Link>
  );
};

export default Logo;
