"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, SquarePen } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ConnectionConfig {
  name: string;
  type: string;
  host: string;
  port: string;
  username: string;
  password: string;
  database: string;
}

export default function ConnectionPage() {
  const [connections, setConnections] = useState<ConnectionConfig[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [newConnection, setNewConnection] = useState<ConnectionConfig>({
    name: "",
    type: "mysql",
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
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Database Connections</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Manage your database connections here
          </p>
        </div>
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
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {connections.map((conn, index) => (
          <Card key={index} className="transition-shadow hover:shadow-lg">
            <CardHeader>
              <CardTitle>{conn.name}</CardTitle>
              <CardDescription>
                {conn.type} - {conn.host}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 text-sm">
                <p>Database: {conn.database}</p>
                <p>Port: {conn.port}</p>
                <p>Username: {conn.username}</p>
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
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:text-white bg-destructive/70 hover:bg-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Connection</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete the connection "
                      {conn.name}"? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleDelete(index)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
