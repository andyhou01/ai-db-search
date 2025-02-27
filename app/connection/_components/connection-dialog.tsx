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
import { ConnectionConfig } from "@/types/dataBase";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

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
  const [connectionMode, setConnectionMode] = useState<"params" | "url">(
    "params"
  );
  const [isLoading, setIsLoading] = useState(false);

  const validateForm = () => {
    const newErrors: Partial<Record<keyof ConnectionConfig, boolean>> = {};
    let isValid = true;

    if (connectionMode === "params") {
      // Check each parameter field
      Object.entries(newConnection).forEach(([key, value]) => {
        if (key !== "url" && !value.trim()) {
          newErrors[key as keyof ConnectionConfig] = true;
          isValid = false;
        }
      });
    } else {
      // Check URL and name fields only
      if (!newConnection.name.trim()) {
        newErrors.name = true;
        isValid = false;
      }
      if (!newConnection.url?.trim()) {
        newErrors.url = true;
        isValid = false;
      }
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = () => {
    if (validateForm()) {
      const connectionToSave = {
        ...newConnection,
        // Clear unused fields based on mode
        ...(connectionMode === "url"
          ? {
              host: "",
              port: "",
              username: "",
              password: "",
              database: "",
            }
          : { url: "" }),
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
    try {
      const response = await fetch("/api/test-connection", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...newConnection,
          // Clear unused fields based on mode
          ...(connectionMode === "url"
            ? {
                host: "",
                port: "",
                username: "",
                password: "",
                database: "",
              }
            : { url: "" }),
        }),
      });

      if (!response.ok) {
        throw new Error("Connection failed");
      }

      toast.success("Connection successful!", {
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
            type: "mysql",
            host: "",
            port: "",
            username: "",
            password: "",
            database: "",
            url: "",
          });
          setErrors({});
          setConnectionMode("params");
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
                <SelectItem value="mysql">MySQL</SelectItem>
                <SelectItem value="postgresql">PostgreSQL</SelectItem>
                <SelectItem value="mongodb">MongoDB</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Connection mode tabs */}
          <Tabs
            value={connectionMode}
            onValueChange={(v) => setConnectionMode(v as "params" | "url")}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="params">Parameters</TabsTrigger>
              <TabsTrigger value="url">Connection URL</TabsTrigger>
            </TabsList>

            <TabsContent value="params" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="host">
                      Host <span className="text-primary">*</span>
                    </Label>
                    {errors.host && (
                      <span className="text-xs text-destructive">Required</span>
                    )}
                  </div>
                  <Input
                    id="host"
                    value={newConnection.host}
                    onChange={(e) =>
                      setNewConnection({
                        ...newConnection,
                        host: e.target.value,
                      })
                    }
                    className={errors.host ? "border-destructive" : ""}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="port">
                      Port <span className="text-primary">*</span>
                    </Label>
                    {errors.port && (
                      <span className="text-xs text-destructive">Required</span>
                    )}
                  </div>
                  <Input
                    id="port"
                    value={newConnection.port}
                    onChange={(e) =>
                      setNewConnection({
                        ...newConnection,
                        port: e.target.value,
                      })
                    }
                    className={errors.port ? "border-destructive" : ""}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="username">
                      Username <span className="text-primary">*</span>
                    </Label>
                    {errors.username && (
                      <span className="text-xs text-destructive">Required</span>
                    )}
                  </div>
                  <Input
                    id="username"
                    value={newConnection.username}
                    onChange={(e) =>
                      setNewConnection({
                        ...newConnection,
                        username: e.target.value,
                      })
                    }
                    className={errors.username ? "border-destructive" : ""}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">
                      Password <span className="text-primary">*</span>
                    </Label>
                    {errors.password && (
                      <span className="text-xs text-destructive">Required</span>
                    )}
                  </div>
                  <Input
                    id="password"
                    type="password"
                    value={newConnection.password}
                    onChange={(e) =>
                      setNewConnection({
                        ...newConnection,
                        password: e.target.value,
                      })
                    }
                    className={errors.password ? "border-destructive" : ""}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="database">
                      Database Name <span className="text-primary">*</span>
                    </Label>
                    {errors.database && (
                      <span className="text-xs text-destructive">Required</span>
                    )}
                  </div>
                  <Input
                    id="database"
                    value={newConnection.database}
                    onChange={(e) =>
                      setNewConnection({
                        ...newConnection,
                        database: e.target.value,
                      })
                    }
                    className={errors.database ? "border-destructive" : ""}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="url" className="space-y-4">
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
                  value={newConnection.url}
                  onChange={(e) =>
                    setNewConnection({ ...newConnection, url: e.target.value })
                  }
                  placeholder={getUrlPlaceholder(newConnection.type)}
                  className={errors.url ? "border-destructive" : ""}
                />
              </div>
            </TabsContent>
          </Tabs>
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
            <Button onClick={handleSubmit} disabled={isLoading}>
              {isEditing ? "Update" : "Save"} Connection
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
export default ConnectionDialog;
