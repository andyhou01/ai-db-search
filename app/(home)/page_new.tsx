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
import { Loader2, Send, User, Database } from "lucide-react";
import { toast } from "sonner";
import { Results } from "@/components/results";
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

// Add new interface for query suggestions
interface QuerySuggestion {
  text: string;
  description: string;
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
  const [querySuggestions, setQuerySuggestions] = useState<QuerySuggestion[]>(
    []
  );
  const [showSuggestions, setShowSuggestions] = useState(false);
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

  // Add new useEffect to generate suggestions when connection changes
  useEffect(() => {
    if (selectedConnection) {
      generateQuerySuggestions(selectedConnection);
      setShowSuggestions(true);
    }
  }, [selectedConnection]);

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

  // Function to generate query suggestions based on the selected connection
  const generateQuerySuggestions = async (connectionUrl: string) => {
    try {
      // First try to get schema from cached enhanced data
      let schemaInfo;
      if (selectedConnectionName) {
        const enhancedSchema = await loadEnhancedSchema(selectedConnectionName);
        if (enhancedSchema) {
          schemaInfo = enhancedSchema.basicSchema;
          console.log(
            `Using cached schema for suggestions: ${selectedConnectionName}`
          );
        }
      }

      // If no cached schema, fetch from database
      if (!schemaInfo) {
        console.log(
          `No cached schema found for suggestions, fetching from database`
        );
        schemaInfo = await getDatabaseSchema(connectionUrl);
      }

      if (!schemaInfo || schemaInfo.tables.length === 0) {
        setShowSuggestions(false);
        return;
      }

      // Generate dynamic suggestions based on schema
      const suggestions: QuerySuggestion[] = [];

      // Get a list of table names
      const tables = Array.from(
        new Set(schemaInfo.tables.map((item: any) => item.name))
      );

      // Add table-specific suggestions
      tables.forEach((table) => {
        // Get columns for this table
        const tableColumns = schemaInfo.tables.find(
          (item: any) => item.name === table
        )?.columns;

        // Find date/time columns
        const dateColumns = tableColumns?.filter(
          (col: any) =>
            col.type.toLowerCase().includes("date") ||
            col.type.toLowerCase().includes("time")
        );

        // Find numeric columns
        const numericColumns = tableColumns
          ?.filter((col: any) =>
            ["int", "float", "decimal", "double", "number", "numeric"].some(
              (type: string) => col.type.toLowerCase().includes(type)
            )
          )
          .filter((col: any) => !col.name.toLowerCase().includes("id"));

        // Add table-specific suggestions
        if (dateColumns && dateColumns.length > 0) {
          suggestions.push({
            text: `Show me ${table} data trends over time by ${dateColumns[0].name}`,
            description: `Visualize time-based patterns in ${table} using the ${dateColumns[0].name} field`,
          });
        }
        suggestions.push({
          text: `How many records are in ${table}?`,
          description: `Display the number of rows in the ${table} table`,
        });

        if (numericColumns && numericColumns.length > 0) {
          suggestions.push({
            text: `What's the average ${numericColumns[0].name} in ${table}?`,
            description: `Calculate the average ${numericColumns[0].name} value in the ${table} table`,
          });

          suggestions.push({
            text: `Find the highest ${numericColumns[0].name} values in ${table}`,
            description: `Identify maximum ${numericColumns[0].name} values in the ${table} table`,
          });
        }
      });

      // Add some cross-table suggestions if there are multiple tables
      if (tables.length > 1) {
        suggestions.push({
          text: `How do ${tables[0]} and ${tables[1]} relate to each other?`,
          description: `Explore the relationship between the ${tables[0]} and ${tables[1]} tables`,
        });
      }

      // Limit to a reasonable number of suggestions
      setQuerySuggestions(suggestions.slice(0, 6));
    } catch (error) {
      console.error("Error generating query suggestions:", error);
      // Fallback to generic suggestions
      setShowSuggestions(false);
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setInputValue("");
    setShowSuggestions(false);
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
      <div className="flex flex-col w-full max-w-4xl h-[86vh] mt-16 overflow-y-auto">
        <motion.div
          className="flex flex-col h-full"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <div className="flex-grow">
            {messages.length === 0 ? (
              <Instruction
                showSuggestions={showSuggestions}
                querySuggestions={querySuggestions}
                handleSubmit={handleSubmit}
              />
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
                                  : message.loadingStep === 2
                                  ? "Running SQL query..."
                                  : message.loadingStep === 3
                                  ? "Generating AI answer..."
                                  : "Creating visualizations..."}
                              </p>
                            </div>
                          ) : (
                            <div className="w-full space-y-4">
                              {message.content && <p>{message.content}</p>}

                              {message.sqlError && (
                                <div className="mt-2">
                                  <Badge variant="outline" className="mb-2">
                                    {message.sqlError.generationIssues?.length
                                      ? "Query Generation Error"
                                      : message.sqlError.functionError
                                      ? "SQL Function Error"
                                      : "SQL Error"}
                                  </Badge>
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
                                  <div className="bg-card border rounded-lg p-4 shadow-sm">
                                    <div className="flex items-center gap-2 mb-3">
                                      <div className="w-2 h-2 bg-primary rounded-full"></div>
                                      <Badge
                                        variant="secondary"
                                        className="bg-primary/10 text-primary"
                                      >
                                        AI Answer
                                      </Badge>
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
                                        className="text-primary border-primary/30 hover:bg-primary/10"
                                      >
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
                                        className="text-primary border-primary/30 hover:bg-primary/10"
                                      >
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
                                    <Badge variant="outline" className="mb-2">
                                      Visualization
                                    </Badge>
                                    <Results
                                      results={message.results}
                                      chartConfig={message.chartConfig}
                                      columns={message.columns}
                                    />
                                  </div>
                                )}

                              {/* Data Table Display - Only when toggled on */}
                              {message.results &&
                                message.results.length > 0 &&
                                message.columns &&
                                message.showData && (
                                  <div className="mt-3">
                                    <Badge variant="outline" className="mb-2">
                                      Data Table
                                    </Badge>
                                    <Results
                                      results={message.results}
                                      chartConfig={null}
                                      columns={message.columns}
                                    />
                                  </div>
                                )}

                              {/* Query Display - Only when toggled on */}
                              {message.query && message.showQuery && (
                                <div className="mt-2">
                                  <Badge variant="outline" className="mb-2">
                                    SQL Query
                                  </Badge>
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
                // Show suggestions when connection changes
                if (url && messages.length === 0) {
                  setShowSuggestions(true);
                }
              }}
            >
              <SelectTrigger className="w-full text-sm border-none h-9 bg-muted">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-muted-foreground" />
                  <SelectValue placeholder="Select the DB" />
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
