import { Info } from "lucide-react";
import { Alert, AlertDescription } from "./ui/alert";

export const ProjectInfo = () => {
  return (
    <div className="p-4 mt-auto bg-muted">
      <Alert className="border-0 bg-muted text-muted-foreground">
        <Info className="w-4 h-4 text-primary" />
        <AlertDescription>
          This application leverages{" "}
          <span className="font-bold text-primary">AI Agent Technology</span> to
          enable natural language querying of databases, making data access
          seamless and intuitive.
        </AlertDescription>
      </Alert>
    </div>
  );
};
