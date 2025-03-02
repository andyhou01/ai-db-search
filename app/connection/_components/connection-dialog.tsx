"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Loader2 } from "lucide-react";
import { ConnectionConfig, DatabaseSchema } from "@/types/dataBase";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { getDatabaseSchema } from "@/actions/dbQuery";

interface ConnectionDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  isEditing: boolean;
  setIsEditing: (editing: boolean) => void;
  editingIndex: number | null;
  setEditingIndex: (index: number | null) => void;
  newConnection: ConnectionConfig;
  setNewConnection: (connection: ConnectionConfig) => void;
  handleSave: (connection: ConnectionConfig) => void;
  handleUpdate: (connection: ConnectionConfig) => void;
}

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

const schemaToString = (schema: DatabaseSchema | undefined) => {
  if (!schema) return "";
  return schema.tables
    .map(
      (table) =>
        `${table.name} (\n${table.columns
          .map(
            (column) =>
              `  ${column.name} ${column.type} ${
                column.nullable ? "" : "NOT NULL"
              }`
          )
          .join("\n")}\n)`
    )
    .join("\n");
};

const ConnectionDialog = ({
  isOpen,
  setIsOpen,
  isEditing,
  setIsEditing,
  editingIndex,
  setEditingIndex,
  newConnection,
  setNewConnection,
  handleSave,
  handleUpdate,
}: ConnectionDialogProps) => {
  const [errors, setErrors] = useState<
    Partial<Record<keyof ConnectionConfig, boolean>>
  >({});
  const [isLoading, setIsLoading] = useState(false);
  const [schemaPreview, setSchemaPreview] = useState<string | null>(null);

  // Set schema preview when editing an existing connection
  useEffect(() => {
    if (isEditing && newConnection.schemaString) {
      setSchemaPreview(newConnection.schemaString);
    }
  }, [isEditing, newConnection.schemaString]);

  const validateForm = () => {
    const newErrors: Partial<Record<keyof ConnectionConfig, boolean>> = {};
    let isValid = true;

    // Check URL and name fields only
    if (!newConnection.name.trim()) {
      newErrors.name = true;
      isValid = false;
    }
    if (!newConnection.url?.trim()) {
      newErrors.url = true;
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = () => {
    if (validateForm()) {
      const connectionToSave = {
        ...newConnection,
        // Clear unused fields
        host: "",
        port: "",
        username: "",
        password: "",
        database: "",
      };

      if (isEditing) {
        handleUpdate(connectionToSave);
      } else {
        handleSave(connectionToSave);
      }
    }
  };

  const testConnection = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    setSchemaPreview(null);

    try {
      const response = await fetch("/api/test-connection", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...newConnection,
          // Clear unused fields
          host: "",
          port: "",
          username: "",
          password: "",
          database: "",
        }),
      });

      if (!response.ok) {
        throw new Error("Connection failed");
      }

      // Fetch schema after successful connection
      const schema = await getDatabaseSchema(newConnection.url || "");
      const schemaString = schemaToString(schema);

      // Update connection with schema
      setNewConnection({
        ...newConnection,
        schema: schema,
        schemaString: schemaString,
      });

      // Set schema preview for display in dialog
      setSchemaPreview(schemaString);

      toast.success("Connection successful! Schema retrieved.", {
        className: "bg-green-500 text-white border-0",
      });
    } catch (error) {
      toast.error("Failed to connect to database!", {
        className: "bg-red-500 text-white border-0",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getUrlPlaceholder = (type: string) => {
    switch (type) {
      case "mysql":
        return "mysql://user:password@host:port/database";
      case "postgresql":
        return "postgresql://user:password@host:port/database";
      case "mongodb":
        return "mongodb://user:password@host:port/database";
      default:
        return "database://user:password@host:port/database";
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) {
          setIsEditing(false);
          setEditingIndex(null);
          setNewConnection({
            name: "",
            type: "postgresql",
            host: "",
            port: "",
            username: "",
            password: "",
            database: "",
            url: "",
          });
          setErrors({});
          setSchemaPreview(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          New Connection
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Connection" : "Add New Connection"}
          </DialogTitle>
          <DialogDescription>
            Configure your database connection settings
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Common fields */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="name">
                Connection Name <span className="text-primary">*</span>
              </Label>
              {errors.name && (
                <span className="text-xs text-destructive">Required</span>
              )}
            </div>
            <Input
              id="name"
              value={newConnection.name}
              onChange={(e) =>
                setNewConnection({ ...newConnection, name: e.target.value })
              }
              placeholder="My Database Connection"
              className={errors.name ? "border-destructive" : ""}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="type">
                Database Type <span className="text-primary">*</span>
              </Label>
              {errors.type && (
                <span className="text-xs text-destructive">Required</span>
              )}
            </div>
            <Select
              value={newConnection.type}
              onValueChange={(value) =>
                setNewConnection({ ...newConnection, type: value })
              }
            >
              <SelectTrigger
                className={errors.type ? "border-destructive" : ""}
              >
                <SelectValue placeholder="Select database type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="postgresql">PostgreSQL</SelectItem>
                <SelectItem value="mysql">MySQL</SelectItem>
                <SelectItem value="mongodb">MongoDB</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Connection URL field */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="url">
                Connection URL <span className="text-primary">*</span>
              </Label>
              {errors.url && (
                <span className="text-xs text-destructive">Required</span>
              )}
            </div>
            <Input
              id="url"
              value={newConnection.url || ""}
              onChange={(e) =>
                setNewConnection({ ...newConnection, url: e.target.value })
              }
              placeholder={getUrlPlaceholder(newConnection.type)}
              className={errors.url ? "border-destructive" : ""}
            />
          </div>

          {/* Schema Preview */}
          {schemaPreview && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Database Schema</Label>
                {/* <span className="text-xs text-muted-foreground">
                  {countColumns(schemaPreview)} columns
                </span> */}
              </div>
              <div className="p-2 font-mono text-xs rounded bg-muted max-h-48 overflow-y-auto">
                <pre>{schemaPreview}</pre>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={testConnection}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Testing...
              </>
            ) : (
              "Test Connection"
            )}
          </Button>
          <div className="flex gap-4">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isLoading}
              className={
                schemaPreview
                  ? "text-white bg-green-600 hover:bg-green-700"
                  : ""
              }
            >
              {isEditing ? "Update" : "Save"} Connection
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
export default ConnectionDialog;
