"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SquarePen } from "lucide-react";
import { ConnectionConfig } from "@/types/dataBase";
import DBDialog from "./_components/connection-dialog";
import DeleteDialog from "./_components/delete-dialog";

function maskConnectionUrl(url: string) {
  try {
    const urlObj = new URL(url);
    // Mask password if present
    if (urlObj.password) {
      const credentials = "****";
      // Reconstruct the URL with masked credentials
      return `${urlObj.protocol}//${urlObj.username}:${credentials}@${urlObj.host}${urlObj.pathname}${urlObj.search}`;
    }
    return url;
  } catch (e) {
    // If URL parsing fails, do basic masking
    const parts = url.split("@");
    if (parts.length > 1) {
      return `${parts[0].split("://")[0]}://*****@${parts[1]}`;
    }
    return url;
  }
}

// Add these helper functions before the component
const countColumns = (schema: string): number => {
  // More accurate column counting
  let columnCount = 0;

  // Split by table definitions
  const tables = schema.split(");");

  // For each table (except the last empty one after the final semicolon)
  for (let i = 0; i < tables.length - 1; i++) {
    const tableContent = tables[i];

    // Find the opening parenthesis that starts the column definitions
    const openParenIndex = tableContent.indexOf("(");
    if (openParenIndex !== -1) {
      // Get the content between parentheses
      const columnsSection = tableContent.substring(openParenIndex + 1);

      // Split by commas and count non-empty lines that aren't just whitespace
      const columns = columnsSection
        .split(",")
        .map((col) => col.trim())
        .filter((col) => col.length > 0);

      columnCount += columns.length;
    }
  }

  return columnCount;
};

export default function ConnectionPage() {
  const [connections, setConnections] = useState<ConnectionConfig[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [showFullSchema, setShowFullSchema] = useState(false);

  const [newConnection, setNewConnection] = useState<ConnectionConfig>({
    name: "",
    type: "postgresql",
    host: "",
    port: "",
    username: "",
    password: "",
    database: "",
  });

  useEffect(() => {
    // Load saved connections from localStorage
    const savedConnections = localStorage.getItem("dbConnections");
    if (savedConnections) {
      setConnections(JSON.parse(savedConnections));
    }
  }, []);

  const handleSave = () => {
    const updatedConnections = [...connections, newConnection];
    setConnections(updatedConnections);
    localStorage.setItem("dbConnections", JSON.stringify(updatedConnections));

    // Reset form and close dialog
    setNewConnection({
      name: "",
      type: "mysql",
      host: "",
      port: "",
      username: "",
      password: "",
      database: "",
    });
    setIsOpen(false);
  };

  const handleEdit = (connection: ConnectionConfig, index: number) => {
    setNewConnection(connection);
    setEditingIndex(index);
    setIsEditing(true);
    setIsOpen(true);
  };

  const handleUpdate = () => {
    if (editingIndex === null) return;

    const updatedConnections = [...connections];
    updatedConnections[editingIndex] = newConnection;
    setConnections(updatedConnections);
    localStorage.setItem("dbConnections", JSON.stringify(updatedConnections));

    // Reset form and close dialog
    setNewConnection({
      name: "",
      type: "mysql",
      host: "",
      port: "",
      username: "",
      password: "",
      database: "",
    });
    setIsEditing(false);
    setEditingIndex(null);
    setIsOpen(false);
  };

  const handleDelete = (index: number) => {
    const updatedConnections = connections.filter((_, i) => i !== index);
    setConnections(updatedConnections);
    localStorage.setItem("dbConnections", JSON.stringify(updatedConnections));
  };

  return (
    <div className="pt-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold">Database Connections</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Manage your database connections here
          </p>
        </div>
        <DBDialog
          isOpen={isOpen}
          setIsOpen={setIsOpen}
          isEditing={isEditing}
          setIsEditing={setIsEditing}
          editingIndex={editingIndex}
          setEditingIndex={setEditingIndex}
          newConnection={newConnection}
          setNewConnection={setNewConnection}
          handleSave={handleSave}
          handleUpdate={handleUpdate}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {connections.map((conn, index) => (
          <Card key={index} className="transition-shadow hover:shadow-lg">
            <CardHeader>
              <CardTitle>{conn.name}</CardTitle>
              <CardDescription>{conn.type} Database</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 text-sm">
                <div className="space-y-1">
                  <p className="font-medium">Connection URL:</p>
                  <p className="p-2 font-mono text-xs break-all rounded bg-muted">
                    {maskConnectionUrl(conn.url || "")}
                  </p>
                </div>

                <div className="pt-2">
                  <p className="font-medium">Schema:</p>
                  {conn.schemaString ? (
                    <div className="mt-1">
                      <div className="p-2 font-mono text-xs rounded bg-muted max-h-32 overflow-y-auto">
                        {conn.schemaString.length > 100 && !showFullSchema ? (
                          <>
                            <pre>{conn.schemaString.substring(0, 100)}</pre>
                            <Button
                              variant="link"
                              className="text-xs text-muted-foreground"
                              onClick={() => setShowFullSchema(true)}
                            >
                              ...view full schema
                            </Button>
                          </>
                        ) : (
                          <pre>{conn.schemaString}</pre>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">Not available</p>
                  )}
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <div className="flex gap-2">
                <Button
                  variant="default"
                  onClick={() => {
                    localStorage.setItem(
                      "selectedConnection",
                      JSON.stringify(conn)
                    );
                  }}
                >
                  Select
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="bg-secondary hover:bg-secondary/70"
                  onClick={() => handleEdit(conn, index)}
                >
                  <SquarePen className="w-4 h-4" />
                </Button>
              </div>
              <DeleteDialog
                name={conn.name}
                index={index}
                handleDelete={handleDelete}
              />
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
