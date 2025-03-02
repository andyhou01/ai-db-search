import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Database } from "lucide-react";

const Instruction = ({
  showSuggestions,
  querySuggestions,
  handleSubmit,
}: {
  showSuggestions: boolean;
  querySuggestions: { text: string; description: string }[];
  handleSubmit: (suggestion: string) => void;
}) => {
  return (
    <div className="flex flex-col items-center justify-center h-full space-y-6 text-center">
      <Database className="w-16 h-16 text-primary" />
      <div className="max-w-md space-y-2">
        <h2 className="text-2xl font-bold">Welcome to Database Assistant</h2>
        <p className="text-muted-foreground">
          Select a database connection and ask questions about your data in
          natural language. I'll generate and run SQL queries to find the
          answers you need.
        </p>
      </div>
      {/* Query suggestions */}
      {showSuggestions && querySuggestions.length > 0 && (
        <motion.div
          className="mt-6 space-y-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <h3 className="text-lg font-medium text-center">
            Suggested queries for this database
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {querySuggestions.map((suggestion, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
              >
                <Button
                  variant="outline"
                  className="w-full justify-start text-left h-auto p-4 border-primary/20 hover:bg-primary/5"
                  onClick={() => handleSubmit(suggestion.text)}
                >
                  <div>
                    <p className="font-medium">{suggestion.text}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {suggestion.description}
                    </p>
                  </div>
                </Button>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default Instruction;
