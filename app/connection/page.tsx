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
