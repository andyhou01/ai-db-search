import { Alert, AlertDescription } from "../../../components/ui/alert";

export default function Footer() {
  return (
    <div className="p-2 bg-transparent border-0 text-muted-foreground text-center text-sm">
      This application leverages{" "}
      <span className="font-semibold">AI Agent Technology</span> to enable
      natural language querying of databases.
    </div>
  );
}
