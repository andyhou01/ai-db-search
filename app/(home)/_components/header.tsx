import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

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
        <h1 className="text-xl font-semibold">Chat with DB</h1>
        {messages.length > 0 && (
          <Button
            variant="outline"
            size="default"
            onClick={handleNewChat}
            className="gap-1 text-sm"
          >
            <Plus className="w-6 h-6 font-bold" />
            New Chat
          </Button>
        )}
      </div>
    </div>
  );
};
export default Header;
