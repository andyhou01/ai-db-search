import { Button } from "@/components/ui/button";
import { Database } from "lucide-react";

const Instruction = () => {
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
      {/* <div className="flex flex-wrap justify-center max-w-md gap-2">
        <Button
          variant="outline"
          onClick={() =>
            handleSuggestionClick("Show me the top 10 customers by revenue")
          }
        >
          Top customers
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            handleSuggestionClick("What were our sales last month?")
          }
        >
          Monthly sales
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            handleSuggestionClick("Show product inventory below 20 units")
          }
        >
          Low inventory
        </Button>
      </div> */}
    </div>
  );
};

export default Instruction;
