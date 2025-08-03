import { Database, Bot, Sparkles } from "lucide-react";

const Instruction = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full space-y-6 text-center">
      <div className="relative">
        <div className="relative p-4 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-950/30 dark:to-purple-950/30 rounded-full">
          <Bot className="w-16 h-16 text-blue-600 dark:text-blue-400" />
          <div className="absolute -top-2 -right-2">
            <div className="p-2 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
          </div>
        </div>
        <div className="absolute -bottom-1 -right-1">
          <Database className="w-6 h-6 text-green-600 dark:text-green-400" />
        </div>
      </div>
      <div className="max-w-md space-y-2">
        <h2 className="text-2xl font-bold">Welcome to Database Assistant</h2>
        <p className="text-muted-foreground">
          Select a database connection and ask questions about your data in
          natural language. I&apos;ll generate and run SQL queries to find the
          answers you need.
        </p>
      </div>
    </div>
  );
};

export default Instruction;
