import Link from "next/link";
import Image from "next/image";
import { useTheme } from "next-themes";

const Logo = () => {
  const { theme } = useTheme();

  return (
    <Link href={"/"} className="flex items-center justify-center gap-4 mb-8">
      {theme === "light" ? (
        <Image src="/logo.svg" alt="logo" width={40} height={28} />
      ) : (
        <Image src="/logo-white.svg" alt="logo" width={40} height={28} />
      )}
      <span className="text-xl font-bold text-[#3B82F6] dark:text-white">
        DB Assistant
      </span>
    </Link>
  );
};
export default Logo;
