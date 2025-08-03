"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  generateChartConfig,
  generateQuery,
  runGenerateSQLQuery,
  getDatabaseSchema,
  loadEnhancedSchema,
  generateAnswerFromResults,
} from "@/actions/dbQuery";
import { Config, Result, AIAnswer } from "@/lib/types";
import {
  Loader2,
  Send,
  User,
  Database,
  Bot,
  Sparkles,
  Brain,
  MessageCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Results } from "@/components/results";
import { DynamicChart } from "@/components/dynamic-chart";
import { QueryViewer } from "@/components/query-viewer";
import { saveChatHistory } from "@/lib/chat-history";
import { SqlErrorDisplay } from "@/components/SqlErrorDisplay";

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
import Header from "./_components/header";

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
  aiAnswer?: AIAnswer;
  showData?: boolean;
  showQuery?: boolean;
  loading?: boolean;
  loadingStep?: number;
  sqlError?: {
    error: string;
    suggestions?: Record<string, string[]>;
    validColumns?: string[];
    suggestedTables?: string[];
    suggestedFunctions?: string[];
    functionError?: boolean;
    generationIssues?: string[];
    generatedQuery?: string;
  };
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
  const [selectedConnectionName, setSelectedConnectionName] =
    useState<string>("");
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
        setSelectedConnectionName(parsed[0].name);
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
      const queryResult = await generateQuery(
        question,
        selectedConnection,
        undefined,
        100,
        selectedConnectionName
      );

      // Check if query generation failed
      if (queryResult.error) {
        updateSystemMessage(systemMessageId, {
          content: "Failed to generate SQL query",
          loading: false,
          sqlError: {
            error: queryResult.message,
            suggestions: {},
            validColumns: [],
            suggestedTables: [],
            generationIssues: queryResult.issues || [],
            generatedQuery: queryResult.query || "",
          },
        });
        setLoading(false);
        return;
      }

      // At this point we know queryResult.query is defined
      const query = queryResult.query;

      // Update system message with query
      updateSystemMessage(systemMessageId, {
        query,
        loadingStep: 2,
      });

      // Run the query
      const queryExecutionResult = await runGenerateSQLQuery(
        query,
        selectedConnection
      );

      // Check if we got an error response
      if (queryExecutionResult && "error" in queryExecutionResult) {
        // Handle SQL error
        updateSystemMessage(systemMessageId, {
          content: "SQL Error",
          query,
          sqlError: {
            error: queryExecutionResult.error || "Unknown SQL error",
            suggestions: queryExecutionResult.suggestions,
            validColumns: queryExecutionResult.validColumns,
            suggestedTables: queryExecutionResult.suggestedTables,
            suggestedFunctions: queryExecutionResult.suggestedFunctions,
            functionError: queryExecutionResult.functionError || false,
          },
          loading: false,
        });
        setLoading(false);
        return;
      }

      // If we get here, queryExecutionResult is a valid Result[]
      const results = queryExecutionResult as Result[];
      const columns = results.length > 0 ? Object.keys(results[0]) : [];

      // Update to step 3 - generating AI answer
      updateSystemMessage(systemMessageId, {
        loadingStep: 3,
      });

      // Generate AI answer from results
      let aiAnswer: AIAnswer | undefined;
      try {
        aiAnswer = await generateAnswerFromResults(question, results);
      } catch (error) {
        console.error("Failed to generate AI answer:", error);
        // Continue without AI answer if it fails
      }

      // Update to step 4 - generating chart config
      updateSystemMessage(systemMessageId, {
        loadingStep: 4,
      });

      // Generate chart config
      let generation;
      try {
        generation = await generateChartConfig(
          results,
          question || "Updated query"
        );
      } catch (error) {
        console.error("Failed to generate chart config:", error);
        // Continue without chart config if it fails
      }

      // Update system message with AI answer first, data hidden initially, charts visible by default
      updateSystemMessage(systemMessageId, {
        content: aiAnswer ? "" : `Here are the results for: "${question}"`,
        aiAnswer,
        results,
        columns,
        chartConfig: generation?.config || null,
        showData: false, // Hide data tables by default
        showQuery: false, // Hide SQL query by default
        loading: false,
      });

      // Save to chat history
      if (results && results.length > 0) {
        // Find the connection name from the URL
        const connectionName =
          connections.find((conn) => conn.url === selectedConnection)?.name ||
          selectedConnection;

        // Make sure query is a string (not undefined)
        const queryString = query || "";
        saveChatHistory(
          question,
          queryString,
          results,
          columns,
          connectionName
        );
      }

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

  const toggleDataView = (messageId: string) => {
    setMessages((prev) =>
      prev.map((message) =>
        message.id === messageId
          ? { ...message, showData: !message.showData }
          : message
      )
    );
  };

  const toggleQueryView = (messageId: string) => {
    setMessages((prev) =>
      prev.map((message) =>
        message.id === messageId
          ? { ...message, showQuery: !message.showQuery }
          : message
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
      <Header messages={messages} handleNewChat={handleNewChat} />

      {/* Scrollable chat area */}
      <div className="flex flex-col w-full max-w-5xl h-[86vh] mt-16 overflow-y-auto pl-4 pr-6 py-8">
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
                        <Avatar className="w-8 h-8 mt-1 ring-2 ring-primary/20">
                          <AvatarImage
                            src="/database-icon.png"
                            alt="AI Assistant"
                          />
                          <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                            <Bot className="w-4 h-4" />
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
                              <div className="relative">
                                <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                                <div className="absolute inset-0 w-5 h-5 animate-ping">
                                  <Sparkles className="w-5 h-5 text-blue-300 opacity-30" />
                                </div>
                              </div>
                              <p className="text-muted-foreground">
                                {message.loadingStep === 1
                                  ? "🔍 Generating SQL query..."
                                  : message.loadingStep === 2
                                  ? "⚡ Running SQL query..."
                                  : message.loadingStep === 3
                                  ? "🧠 Generating AI answer..."
                                  : "📊 Creating visualizations..."}
                              </p>
                            </div>
                          ) : (
                            <div className="w-full space-y-4">
                              {message.content && <p>{message.content}</p>}

                              {message.sqlError && (
                                <div className="mt-2">
                                  <div className="flex items-center gap-2 mb-2">
                                    <div className="w-2 h-2 bg-gradient-to-r from-red-400 to-orange-500 rounded-full animate-pulse"></div>
                                    <Badge
                                      variant="outline"
                                      className="bg-gradient-to-r from-red-100 to-orange-100 dark:from-red-950/30 dark:to-orange-950/30 border-red-200/50 dark:border-red-800/30 text-red-700 dark:text-red-300"
                                    >
                                      ⚠️{" "}
                                      {message.sqlError.generationIssues?.length
                                        ? "Query Generation Error"
                                        : message.sqlError.functionError
                                        ? "SQL Function Error"
                                        : "SQL Error"}
                                    </Badge>
                                  </div>
                                  <SqlErrorDisplay
                                    error={message.sqlError.error}
                                    originalQuery={message.query || ""}
                                    suggestions={message.sqlError.suggestions}
                                    validColumns={message.sqlError.validColumns}
                                    suggestedTables={
                                      message.sqlError.suggestedTables
                                    }
                                    suggestedFunctions={
                                      message.sqlError.suggestedFunctions
                                    }
                                    functionError={
                                      message.sqlError.functionError
                                    }
                                    generationIssues={
                                      message.sqlError.generationIssues
                                    }
                                    generatedQuery={
                                      message.sqlError.generatedQuery
                                    }
                                    onRetry={(updatedQuery) => {
                                      // Create a new query with the updated SQL
                                      const newSystemMessageId =
                                        Date.now().toString();
                                      setMessages((prev) => [
                                        ...prev,
                                        {
                                          id: newSystemMessageId,
                                          type: "system",
                                          content: "",
                                          timestamp: new Date(),
                                          query: updatedQuery,
                                          loading: true,
                                          loadingStep: 2,
                                        },
                                      ]);

                                      // Run the updated query
                                      (async () => {
                                        try {
                                          const queryResult =
                                            await runGenerateSQLQuery(
                                              updatedQuery,
                                              selectedConnection
                                            );

                                          // Check if we got an error response again
                                          if (
                                            queryResult &&
                                            "error" in queryResult
                                          ) {
                                            // Handle SQL error
                                            updateSystemMessage(
                                              newSystemMessageId,
                                              {
                                                content: "SQL Error",
                                                query: updatedQuery,
                                                sqlError: {
                                                  error:
                                                    queryResult.error ||
                                                    "Unknown SQL error",
                                                  suggestions:
                                                    queryResult.suggestions,
                                                  validColumns:
                                                    queryResult.validColumns,
                                                  suggestedTables:
                                                    queryResult.suggestedTables,
                                                  suggestedFunctions:
                                                    queryResult.suggestedFunctions,
                                                  functionError:
                                                    queryResult.functionError ||
                                                    false,
                                                },
                                                loading: false,
                                              }
                                            );
                                            return;
                                          }

                                          // If we get here, queryResult is a valid Result[]
                                          const results =
                                            queryResult as Result[];
                                          const columns =
                                            results.length > 0
                                              ? Object.keys(results[0])
                                              : [];

                                          // Generate AI answer from results
                                          let aiAnswer: AIAnswer | undefined;
                                          try {
                                            aiAnswer =
                                              await generateAnswerFromResults(
                                                "Updated query",
                                                results
                                              );
                                          } catch (error) {
                                            console.error(
                                              "Failed to generate AI answer:",
                                              error
                                            );
                                            // Continue without AI answer if it fails
                                          }

                                          // Generate chart config
                                          let generation;
                                          try {
                                            generation =
                                              await generateChartConfig(
                                                results,
                                                "Updated query"
                                              );
                                          } catch (error) {
                                            console.error(
                                              "Failed to generate chart config:",
                                              error
                                            );
                                            // Continue without chart config if it fails
                                          }

                                          // Update system message with results
                                          updateSystemMessage(
                                            newSystemMessageId,
                                            {
                                              content: aiAnswer
                                                ? ""
                                                : `Here are the results for the updated query:`,
                                              aiAnswer,
                                              results,
                                              columns,
                                              chartConfig:
                                                generation?.config || null,
                                              showData: false,
                                              showQuery: false,
                                              loading: false,
                                            }
                                          );
                                        } catch (e) {
                                          updateSystemMessage(
                                            newSystemMessageId,
                                            {
                                              content:
                                                "An error occurred. Please try again.",
                                              loading: false,
                                            }
                                          );
                                        }
                                      })();
                                    }}
                                  />
                                </div>
                              )}

                              {/* AI Answer Display */}
                              {message.aiAnswer && (
                                <div className="mt-3">
                                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200/50 dark:border-blue-800/30 rounded-lg p-4 shadow-sm">
                                    <div className="flex items-center gap-2 mb-3">
                                      <div className="flex items-center gap-2">
                                        <div className="relative">
                                          <Brain className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                          <div className="absolute -top-1 -right-1">
                                            <Sparkles className="w-2.5 h-2.5 text-yellow-500 animate-pulse" />
                                          </div>
                                        </div>
                                        <Badge
                                          variant="secondary"
                                          className="bg-gradient-to-r from-blue-500 to-purple-600 text-white border-0 shadow-sm"
                                        >
                                          ✨ AI Analysis
                                        </Badge>
                                      </div>
                                    </div>
                                    <div className="space-y-3">
                                      <p className="text-foreground font-medium leading-relaxed">
                                        {message.aiAnswer.answer}
                                      </p>

                                      {message.aiAnswer.keyInsights.length >
                                        0 && (
                                        <div>
                                          <h4 className="text-sm font-semibold text-muted-foreground mb-2">
                                            Key Insights:
                                          </h4>
                                          <ul className="space-y-1">
                                            {message.aiAnswer.keyInsights.map(
                                              (insight, index) => (
                                                <li
                                                  key={index}
                                                  className="flex items-start gap-2 text-sm text-muted-foreground"
                                                >
                                                  <span className="text-primary mt-1">
                                                    •
                                                  </span>
                                                  <span>{insight}</span>
                                                </li>
                                              )
                                            )}
                                          </ul>
                                        </div>
                                      )}

                                      {message.aiAnswer.summary && (
                                        <div className="bg-muted/50 border-l-4 border-primary pl-3 py-2">
                                          <p className="text-sm text-muted-foreground italic">
                                            {message.aiAnswer.summary}
                                          </p>
                                        </div>
                                      )}
                                    </div>

                                    <div className="mt-4 flex gap-2">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                          toggleDataView(message.id)
                                        }
                                        className="text-blue-600 border-blue-200 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-800 dark:hover:bg-blue-950/20 transition-all duration-200"
                                      >
                                        <Database className="w-3 h-3 mr-1" />
                                        {message.showData
                                          ? "Hide Data Table"
                                          : "Show Data Table"}
                                      </Button>

                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                          toggleQueryView(message.id)
                                        }
                                        className="text-green-600 border-green-200 hover:bg-green-50 dark:text-green-400 dark:border-green-800 dark:hover:bg-green-950/20 transition-all duration-200"
                                      >
                                        <Brain className="w-3 h-3 mr-1" />
                                        {message.showQuery
                                          ? "Hide SQL Query"
                                          : "Show SQL Query"}
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Chart Display - Always visible if available */}
                              {message.results &&
                                message.results.length > 0 &&
                                message.columns &&
                                message.chartConfig && (
                                  <div className="mt-3">
                                    <div className="flex items-center gap-2 mb-2">
                                      <div className="w-2 h-2 bg-gradient-to-r from-orange-400 to-pink-500 rounded-full"></div>
                                      <Badge
                                        variant="outline"
                                        className="bg-gradient-to-r from-orange-100 to-pink-100 dark:from-orange-950/30 dark:to-pink-950/30 border-orange-200/50 dark:border-orange-800/30 text-orange-700 dark:text-orange-300"
                                      >
                                        📊 Visualization
                                      </Badge>
                                    </div>
                                    <div className="border rounded-lg p-4">
                                      <DynamicChart
                                        chartData={message.results}
                                        chartConfig={message.chartConfig}
                                      />
                                    </div>
                                  </div>
                                )}

                              {/* Data Table Display - Only when toggled on */}
                              {message.results &&
                                message.results.length > 0 &&
                                message.columns &&
                                message.showData && (
                                  <div className="mt-3">
                                    <div className="flex items-center gap-2 mb-2">
                                      <div className="w-2 h-2 bg-gradient-to-r from-blue-400 to-cyan-500 rounded-full"></div>
                                      <Badge
                                        variant="outline"
                                        className="bg-gradient-to-r from-blue-100 to-cyan-100 dark:from-blue-950/30 dark:to-cyan-950/30 border-blue-200/50 dark:border-blue-800/30 text-blue-700 dark:text-blue-300"
                                      >
                                        🗃️ Data Table
                                      </Badge>
                                    </div>
                                    <Results
                                      results={message.results}
                                      chartConfig={message.chartConfig || null}
                                      columns={message.columns}
                                      tableOnly={true}
                                    />
                                  </div>
                                )}

                              {/* Query Display - Only when toggled on */}
                              {message.query && message.showQuery && (
                                <div className="mt-2">
                                  <div className="flex items-center gap-2 mb-2">
                                    <div className="w-2 h-2 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full"></div>
                                    <Badge
                                      variant="outline"
                                      className="bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-950/30 dark:to-emerald-950/30 border-green-200/50 dark:border-green-800/30 text-green-700 dark:text-green-300"
                                    >
                                      💾 SQL Query
                                    </Badge>
                                  </div>
                                  <QueryViewer
                                    activeQuery={message.query}
                                    inputValue=""
                                    connectionUrl={selectedConnection}
                                    connectionName={selectedConnectionName}
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
                        <Avatar className="w-8 h-8 mt-1 ring-2 ring-green-500/20">
                          <AvatarImage src="/user-avatar.png" alt="User" />
                          <AvatarFallback className="bg-gradient-to-br from-green-500 to-emerald-600 text-white">
                            <MessageCircle className="w-4 h-4" />
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
      <div className="fixed z-20 w-full max-w-5xl bottom-0 bg-primary-foreground pt-2">
        <div className="flex gap-3 p-4 rounded-xl bg-background">
          <div className="flex items-center w-1/5">
            <Select
              value={
                selectedConnection && selectedConnectionName
                  ? `${selectedConnection}|||${selectedConnectionName}`
                  : ""
              }
              onValueChange={(value) => {
                // Extract URL and name from the composite value
                const parts = value.split("|||");
                const url = parts[0];
                const name = parts[1];

                setSelectedConnection(url);
                setSelectedConnectionName(name);
              }}
            >
              <SelectTrigger className="w-full text-sm border-none h-9 bg-muted">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Database className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <div className="absolute -top-0.5 -right-0.5">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                    </div>
                  </div>
                  <SelectValue placeholder="Select Database" />
                </div>
              </SelectTrigger>
              <SelectContent>
                {connections.length === 0 ? (
                  <div className="px-2 py-4 text-sm text-center text-muted-foreground">
                    No connections found. Add one in settings.
                  </div>
                ) : (
                  connections.map((conn) => (
                    <SelectItem
                      key={`${conn.url}|||${conn.name}`}
                      value={`${conn.url}|||${conn.name}`}
                    >
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
              className="px-4 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white border-0 shadow-sm transition-all duration-200"
            >
              {loading ? (
                <div className="relative">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <Send className="w-4 h-4" />
                  <Sparkles className="w-3 h-3 opacity-70" />
                </div>
              )}
            </Button>
          </div>
        </div>
        <Footer />
      </div>
    </div>
  );
}
