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
import { Plus } from "lucide-react";
import { ConnectionConfig } from "@/types/dataBase";
import { useState } from "react";

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

  const validateForm = () => {
    const newErrors: Partial<Record<keyof ConnectionConfig, boolean>> = {};
    let isValid = true;

    // Check each field
    Object.entries(newConnection).forEach(([key, value]) => {
      if (!value.trim()) {
        newErrors[key as keyof ConnectionConfig] = true;
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = () => {
    if (validateForm()) {
      // Use placeholder values if host or port are empty
      const connectionToSave = {
        ...newConnection,
      };

      if (isEditing) {
        handleUpdate(connectionToSave);
      } else {
        handleSave(connectionToSave);
      }
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
          });
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
        <div className="grid grid-cols-2 gap-4 py-4">
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
                setNewConnection({ ...newConnection, host: e.target.value })
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
                setNewConnection({ ...newConnection, port: e.target.value })
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
        <div className="flex justify-end gap-4">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            {isEditing ? "Update" : "Save"} Connection
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
export default ConnectionDialog;
