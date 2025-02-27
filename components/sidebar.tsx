import Link from "next/link";

export default function Sidebar() {
  return (
    <div className="fixed top-0 left-0 w-64 h-screen border-r border-gray-200 bg-gray-50 dark:bg-neutral-950 dark:border-neutral-800">
      <div className="p-4">
        <h1 className="mb-8 text-xl font-bold text-black dark:text-white">
          DB Assistant
        </h1>
        <nav>
          <ul className="space-y-2">
            <li>
              <Link
                href="/"
                className="flex items-center p-3 text-black transition-colors rounded-lg dark:text-gray-200 hover:bg-neutral-200 dark:hover:bg-neutral-800"
              >
                <span>Chat with DB</span>
              </Link>
            </li>
            <li>
              <Link
                href="/connections"
                className="flex items-center p-3 text-black transition-colors rounded-lg dark:text-gray-200 hover:bg-neutral-200 dark:hover:bg-neutral-800"
              >
                <span>DB Connections</span>
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  );
}
