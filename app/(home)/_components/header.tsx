import { Button } from "@/components/ui/button";
import { Plus, Bot, Sparkles } from "lucide-react";

const Header = ({
  messages,
  handleNewChat,
}: {
  messages: any[];
  handleNewChat: () => void;
}) => {
  return (
    <div className="fixed z-20 w-full max-w-6xl px-4 pt-6 pb-2 top-0 bg-primary-foreground">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Bot className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <div className="absolute -top-1 -right-1">
              <Sparkles className="w-3 h-3 text-yellow-500 animate-pulse" />
            </div>
          </div>
          <h1 className="text-xl font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Chat with DB
          </h1>
        </div>
        {messages.length > 0 && (
          <Button
            variant="outline"
            size="default"
            onClick={handleNewChat}
            className="gap-2 text-sm border-blue-200 hover:bg-blue-50 dark:border-blue-800 dark:hover:bg-blue-950/20 transition-all duration-200"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Chat</span>
          </Button>
        )}
      </div>
    </div>
  );
};
export default Header;
