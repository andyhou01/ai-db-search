"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  generateChartConfig,
  generateQuery,
  runGenerateSQLQuery,
} from "@/actions/dbQuery";
import { Config, Result } from "@/lib/types";
import { Loader2, Send, User, Database, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Results } from "@/components/results";
import { QueryViewer } from "@/components/query-viewer";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import Instruction from "./_components/instruction";
import Footer from "./_components/footer";

// Define message types
type MessageType = "user" | "system";

interface Message {
  id: string;
  type: MessageType;
  content: string;
  timestamp: Date;
  query?: string;
  results?: Result[];
  columns?: string[];
  chartConfig?: Config | null;
  loading?: boolean;
  loadingStep?: number;
}

export default function Page() {
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(1);
  const [connections, setConnections] = useState<
    Array<{ name: string; url: string }>
  >([]);
  const [selectedConnection, setSelectedConnection] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedConnections = localStorage.getItem("dbConnections");
    if (savedConnections) {
      const parsed = JSON.parse(savedConnections);
      setConnections(parsed);
      // Set first connection as default if available
      if (parsed.length > 0) {
        setSelectedConnection(parsed[0].url);
      }
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSubmit = async (suggestion?: string) => {
    const question = suggestion ?? inputValue;
    if (question.length === 0) return;
    if (!selectedConnection) {
      toast.error("Please select a database connection first");
      return;
    }

    // Add user message
    const userMessageId = Date.now().toString();
    setMessages((prev) => [
      ...prev,
      {
        id: userMessageId,
        type: "user",
        content: question,
        timestamp: new Date(),
      },
    ]);

    // Add system message placeholder
    const systemMessageId = (Date.now() + 1).toString();
    setMessages((prev) => [
      ...prev,
      {
        id: systemMessageId,
        type: "system",
        content: "",
        timestamp: new Date(),
        loading: true,
        loadingStep: 1,
      },
    ]);

    setInputValue("");
    setLoading(true);
    setLoadingStep(1);

    try {
      // Generate SQL query
      const query = await generateQuery(question, selectedConnection);
      if (query === undefined) {
        updateSystemMessage(systemMessageId, {
          content: "Failed to generate SQL query. Please try again.",
          loading: false,
        });
        setLoading(false);
        return;
      }

      // Update system message with query
      updateSystemMessage(systemMessageId, {
        query,
        loadingStep: 2,
      });

      // Run the query
      const results = await runGenerateSQLQuery(query, selectedConnection);
      const columns = results.length > 0 ? Object.keys(results[0]) : [];

      // Generate chart config
      const generation = await generateChartConfig(results, question);

      // Update system message with results
      updateSystemMessage(systemMessageId, {
        content: `Here are the results for: "${question}"`,
        results,
        columns,
        chartConfig: generation.config,
        loading: false,
      });

      setLoading(false);
    } catch (e) {
      updateSystemMessage(systemMessageId, {
        content: "An error occurred. Please try again.",
        loading: false,
      });
      setLoading(false);
    }
  };

  const updateSystemMessage = (id: string, updates: Partial<Message>) => {
    setMessages((prev) =>
      prev.map((message) =>
        message.id === id ? { ...message, ...updates } : message
      )
    );
  };

  const handleNewChat = () => {
    setMessages([]);
    setInputValue("");
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "numeric",
      hour12: true,
    }).format(date);
  };

  return (
    <div className="flex flex-col items-center justify-center">
      {/* Header */}
      <div className="fixed z-20 w-full max-w-6xl px-4 pt-4 pb-2 top-0 bg-primary-foreground">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Chat with DB</h1>
          {messages.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleNewChat}
              className="gap-1"
            >
              <Plus className="w-4 h-4" />
              New Chat
            </Button>
          )}
        </div>
      </div>

      {/* Scrollable chat area */}
      <div className="flex flex-col w-full max-w-4xl h-[86vh] mt-16 overflow-y-auto">
        <motion.div
          className="flex flex-col h-full"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <div className="flex-grow">
            {messages.length === 0 ? (
              <Instruction />
            ) : (
              <div className="space-y-6">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`group flex ${
                      message.type === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div className={`flex gap-3 max-w-[95%]`}>
                      {message.type === "system" && (
                        <Avatar className="w-8 h-8 mt-1">
                          <AvatarImage src="/database-icon.png" alt="DB" />
                          <AvatarFallback className="bg-primary/10 text-primary">
                            <Database className="w-4 h-4" />
                          </AvatarFallback>
                        </Avatar>
                      )}

                      <div className="space-y-2">
                        <div
                          className={`rounded-lg p-4 ${
                            message.type === "user"
                              ? "bg-secondary text-secondary-foreground"
                              : "bg-card border shadow-sm"
                          }`}
                        >
                          {message.type === "user" ? (
                            <div>
                              <p>{message.content}</p>
                            </div>
                          ) : message.loading ? (
                            <div className="flex items-center gap-3">
                              <Loader2 className="w-5 h-5 animate-spin text-primary" />
                              <p>
                                {message.loadingStep === 1
                                  ? "Generating SQL query..."
                                  : "Running SQL query..."}
                              </p>
                            </div>
                          ) : (
                            <div className="w-full space-y-4 mb-6">
                              <p>{message.content}</p>

                              {message.query && (
                                <div className="mt-2">
                                  <Badge variant="outline" className="mb-2">
                                    SQL Query
                                  </Badge>
                                  <QueryViewer
                                    activeQuery={message.query}
                                    inputValue=""
                                  />
                                </div>
                              )}

                              {message.results &&
                                message.results.length > 0 &&
                                message.columns && (
                                  <div className="mt-3">
                                    <Badge variant="outline" className="mb-2">
                                      Results
                                    </Badge>
                                    <Results
                                      results={message.results}
                                      chartConfig={message.chartConfig ?? null}
                                      columns={message.columns}
                                    />
                                  </div>
                                )}
                            </div>
                          )}
                        </div>
                        {/* <div className="px-1 text-xs text-muted-foreground">
                          {formatTime(message.timestamp)}
                        </div> */}
                      </div>

                      {message.type === "user" && (
                        <Avatar className="w-8 h-8 mt-1">
                          <AvatarImage src="/user-avatar.png" alt="User" />
                          <AvatarFallback className="bg-primary text-primary-foreground">
                            <User className="w-4 h-4" />
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} className="h-10" />
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Fixed input area at bottom */}
      <div className="fixed z-20 w-full max-w-4xl bottom-0 bg-primary-foreground pt-2">
        <div className="flex gap-3 p-4 rounded-xl bg-background">
          <div className="flex items-center w-1/5">
            <Select
              value={selectedConnection}
              onValueChange={setSelectedConnection}
            >
              <SelectTrigger className="w-full text-sm border-none h-9 bg-muted">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-muted-foreground" />
                  <SelectValue placeholder="Select a database connection" />
                </div>
              </SelectTrigger>
              <SelectContent>
                {connections.length === 0 ? (
                  <div className="px-2 py-4 text-sm text-center text-muted-foreground">
                    No connections found. Add one in settings.
                  </div>
                ) : (
                  connections.map((conn) => (
                    <SelectItem key={conn.url} value={conn.url}>
                      {conn.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 w-4/5">
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask a question about your data..."
              className="flex-grow border-primary/20 focus-visible:ring-primary/30"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              disabled={loading}
            />
            <Button
              onClick={() => handleSubmit()}
              disabled={loading || inputValue.trim() === ""}
              className="px-4"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
        <Footer />
      </div>
    </div>
  );
}
