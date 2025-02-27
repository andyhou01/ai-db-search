import { Alert, AlertDescription } from "./ui/alert";

export default function Footer() {
  return (
    <footer className="fixed bottom-0 right-0 ml-64 w-[calc(100%-16rem)] text-center">
      <Alert className="bg-transparent border-0 text-muted-foreground">
        <AlertDescription>
          This application leverages{" "}
          <span className="font-bold text-primary">AI Agent Technology</span> to
          enable natural language querying of databases, making data access
          seamless and intuitive.
        </AlertDescription>
      </Alert>
    </footer>
  );
}
