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

interface ConnectionDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  isEditing: boolean;
  setIsEditing: (editing: boolean) => void;
  editingIndex: number | null;
  setEditingIndex: (index: number | null) => void;
  newConnection: ConnectionConfig;
  setNewConnection: (connection: ConnectionConfig) => void;
  handleSave: () => void;
  handleUpdate: () => void;
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
          <Plus className="w-4 h-4" />
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
            <Label htmlFor="name">Connection Name</Label>
            <Input
              id="name"
              value={newConnection.name}
              onChange={(e) =>
                setNewConnection({ ...newConnection, name: e.target.value })
              }
              placeholder="My Database Connection"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="type">Database Type</Label>
            <Select
              value={newConnection.type}
              onValueChange={(value) =>
                setNewConnection({ ...newConnection, type: value })
              }
            >
              <SelectTrigger>
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
            <Label htmlFor="host">Host</Label>
            <Input
              id="host"
              value={newConnection.host}
              onChange={(e) =>
                setNewConnection({ ...newConnection, host: e.target.value })
              }
              placeholder="localhost"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="port">Port</Label>
            <Input
              id="port"
              value={newConnection.port}
              onChange={(e) =>
                setNewConnection({ ...newConnection, port: e.target.value })
              }
              placeholder="3306"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={newConnection.username}
              onChange={(e) =>
                setNewConnection({
                  ...newConnection,
                  username: e.target.value,
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
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
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="database">Database Name</Label>
            <Input
              id="database"
              value={newConnection.database}
              onChange={(e) =>
                setNewConnection({
                  ...newConnection,
                  database: e.target.value,
                })
              }
            />
          </div>
        </div>
        <div className="flex justify-end gap-4">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button onClick={isEditing ? handleUpdate : handleSave}>
            {isEditing ? "Update" : "Save"} Connection
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
export default ConnectionDialog;
