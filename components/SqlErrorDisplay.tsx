"use client";

import React, { useState, ChangeEvent } from "react";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Badge } from "./ui/badge";

interface SqlErrorDisplayProps {
  error: string;
  originalQuery: string;
  suggestions?: Record<string, string[]>;
  validColumns?: string[];
  suggestedTables?: string[];
  suggestedFunctions?: string[];
  functionError?: boolean;
  generationIssues?: string[];
  generatedQuery?: string;
  onRetry: (updatedQuery: string) => void;
}

export function SqlErrorDisplay({
  error,
  originalQuery,
  suggestions = {},
  validColumns = [],
  suggestedTables = [],
  suggestedFunctions = [],
  functionError = false,
  generationIssues = [],
  generatedQuery,
  onRetry,
}: SqlErrorDisplayProps) {
  const [editedQuery, setEditedQuery] = useState(
    originalQuery || generatedQuery || ""
  );
  const isGenerationError = generationIssues.length > 0;

  // Helper to apply a suggestion
  const applySuggestion = (invalidColumn: string, suggestion: string) => {
    // Create a regex that matches the whole word
    const regex = new RegExp(`\\b${invalidColumn}\\b`, "gi");
    const newQuery = editedQuery.replace(regex, suggestion);
    setEditedQuery(newQuery);
  };

  // Helper to apply a table suggestion
  const applyTableSuggestion = (suggestion: string) => {
    // Try to find the table name in the query and replace it
    const fromRegex = /\bfrom\s+([a-zA-Z_][a-zA-Z0-9_]*)/i;
    const match = editedQuery.match(fromRegex);

    if (match) {
      const newQuery = editedQuery.replace(match[1], suggestion);
      setEditedQuery(newQuery);
    }
  };

  // Helper to apply a function suggestion
  const applyFunctionSuggestion = (suggestion: string) => {
    // Extract the function name from the error message
    const functionMatch = error.match(/function '([^']+)'/i);
    if (functionMatch) {
      const invalidFunction = functionMatch[1].trim();
      const regex = new RegExp(`\\b${invalidFunction}\\b`, "gi");
      const newQuery = editedQuery.replace(regex, suggestion);
      setEditedQuery(newQuery);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="bg-red-50 dark:bg-red-900/20">
        <CardTitle className="text-red-600 dark:text-red-400">
          {isGenerationError ? "Query Generation Error" : "SQL Error"}
        </CardTitle>
        <CardDescription>{error}</CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="space-y-4">
          {/* Show generation issues */}
          {generationIssues.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Issues:</h3>
              <ul className="list-disc pl-5 space-y-1">
                {generationIssues.map((issue, index) => (
                  <li key={index} className="text-sm text-muted-foreground">
                    {issue}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Show function suggestions */}
          {functionError && suggestedFunctions.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Available SQL functions:</h3>
              <div className="flex flex-wrap gap-2">
                {suggestedFunctions.map((func) => (
                  <Badge
                    key={func}
                    variant="outline"
                    className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                    onClick={() => applyFunctionSuggestion(func)}
                  >
                    {func}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Show column suggestions */}
          {Object.keys(suggestions).length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Suggestions:</h3>
              {Object.entries(suggestions).map(
                ([invalidColumn, columnSuggestions]) => (
                  <div
                    key={invalidColumn}
                    className="pl-2 border-l-2 border-muted-foreground/20"
                  >
                    <p className="text-sm text-muted-foreground">
                      Replace{" "}
                      <code className="bg-muted px-1 rounded">
                        {invalidColumn}
                      </code>{" "}
                      with:
                    </p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {columnSuggestions.map((suggestion) => (
                        <Badge
                          key={suggestion}
                          variant="outline"
                          className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                          onClick={() =>
                            applySuggestion(invalidColumn, suggestion)
                          }
                        >
                          {suggestion}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )
              )}
            </div>
          )}

          {/* Show table suggestions */}
          {suggestedTables.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Available tables:</h3>
              <div className="flex flex-wrap gap-2">
                {suggestedTables.map((table) => (
                  <Badge
                    key={table}
                    variant="outline"
                    className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                    onClick={() => applyTableSuggestion(table)}
                  >
                    {table}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Show valid columns */}
          {validColumns.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Available columns:</h3>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                {validColumns.map((column) => (
                  <Badge key={column} variant="outline">
                    {column}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Edit query */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Edit your query:</h3>
            <textarea
              value={editedQuery}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                setEditedQuery(e.target.value)
              }
              className="w-full font-mono text-sm p-2 border rounded-md"
              rows={5}
            />
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-end space-x-2">
        <Button
          variant="secondary"
          onClick={() => setEditedQuery(originalQuery || generatedQuery || "")}
        >
          Reset
        </Button>
        <Button onClick={() => onRetry(editedQuery)}>Try Again</Button>
      </CardFooter>
    </Card>
  );
}
