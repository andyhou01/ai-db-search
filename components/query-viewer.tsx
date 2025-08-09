import { useState } from "react";
import { Button } from "./ui/button";
import { QueryWithTooltips } from "./ui/query-with-tooltips";
import { explainQuery } from "@/actions/dbQuery";
import { QueryExplanation } from "@/lib/types";
import { CircleHelp, Loader2, Copy, Check } from "lucide-react";
import { toast } from "sonner";

export const QueryViewer = ({
  activeQuery,
  inputValue,
  connectionUrl,
  connectionName,
  businessLogic,
}: {
  activeQuery: string;
  inputValue: string;
  connectionUrl?: string;
  connectionName?: string;
  businessLogic?: string;
}) => {
  const activeQueryCutoff = 100;

  const [queryExplanations, setQueryExplanations] = useState<
    QueryExplanation[] | null
  >();
  const [loadingExplanation, setLoadingExplanation] = useState(false);
  const [queryExpanded, setQueryExpanded] = useState(
    activeQuery.length > activeQueryCutoff
  );
  const [copied, setCopied] = useState(false);

  const handleCopyQuery = async () => {
    try {
      await navigator.clipboard.writeText(activeQuery);
      setCopied(true);
      toast.success("SQL query copied to clipboard!");

      // Reset the copied state after 2 seconds
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (error) {
      console.error("Failed to copy query:", error);
      toast.error("Failed to copy query to clipboard");
    }
  };

  // Generate explanations when user clicks the explain button
  const handleExplainQuery = async () => {
    if (!connectionUrl || loadingExplanation) return;

    setQueryExpanded(true);
    setLoadingExplanation(true);
    try {
      const { explanations } = await explainQuery(
        inputValue,
        activeQuery,
        connectionUrl,
        undefined,
        connectionName,
        businessLogic
      );
      setQueryExplanations(explanations);
    } catch (error) {
      console.error("Failed to generate explanations:", error);
      toast.error("Failed to generate query explanations");
    }
    setLoadingExplanation(false);
  };

  if (activeQuery.length === 0) return null;

  return (
    <div className="relative mb-4 group">
      <div
        className={`bg-muted rounded-md p-4 ${
          queryExpanded ? "" : "text-muted-foreground"
        }`}
      >
        <div className="font-mono text-sm">
          {queryExpanded ? (
            queryExplanations && queryExplanations.length > 0 ? (
              <div className="space-y-3">
                {/* SQL Query Display */}
                <QueryWithTooltips
                  query={activeQuery}
                  queryExplanations={queryExplanations}
                />

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-2 border-t border-muted-foreground/10">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyQuery}
                      className="h-9 px-4 border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-950/20 transition-all duration-200 hover:scale-105 font-medium"
                      aria-label="Copy SQL query to clipboard"
                    >
                      {copied ? (
                        <div className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-green-600" />
                          <span className="text-sm text-green-600">
                            Copied!
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Copy className="w-4 h-4" />
                          <span className="text-sm">Copy Query</span>
                        </div>
                      )}{" "}
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExplainQuery}
                      className="h-9 px-4 border-gray-300 text-gray-500 bg-gray-50 dark:border-gray-700 dark:text-gray-500 dark:bg-gray-800/50 cursor-not-allowed font-medium"
                      aria-label="Explanations already generated"
                      disabled={true}
                    >
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-600" />
                        <span className="text-sm">Already Explained</span>
                      </div>
                    </Button>
                  </div>

                  {/* <div className="text-xs text-muted-foreground">
                    Query ready for analysis
                  </div> */}
                </div>

                {/* Interactive Explanation Info */}
                <div className="mt-4 p-3 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-800/30 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide">
                      Interactive Explanation
                    </span>
                  </div>
                  <p className="text-sm text-blue-800 dark:text-blue-200 font-medium leading-relaxed">
                    💡 Hover over different parts of the SQL query above to see
                    detailed explanations
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* SQL Query Display */}
                <div className="bg-slate-900 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-2 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      </div>
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-400 ml-2">
                        SQL Query
                      </span>
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-500">
                      Ready for explanation
                    </span>
                  </div>

                  {/* Query Content */}
                  <div className="p-4 overflow-x-auto">
                    <pre className="font-mono text-sm leading-relaxed text-slate-100 dark:text-slate-200 whitespace-pre-wrap">
                      {activeQuery}
                    </pre>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-2 border-t border-muted-foreground/10">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyQuery}
                      className="h-9 px-4 border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-950/20 transition-all duration-200 hover:scale-105 font-medium"
                      aria-label="Copy SQL query to clipboard"
                    >
                      {copied ? (
                        <div className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-green-600" />
                          <span className="text-sm text-green-600">
                            Copied!
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Copy className="w-4 h-4" />
                          <span className="text-sm">Copy Query</span>
                        </div>
                      )}
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExplainQuery}
                      className="h-9 px-4 border-green-200 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-300 dark:hover:bg-green-950/20 transition-all duration-200 hover:scale-105 font-medium"
                      aria-label="Generate AI explanations for SQL query"
                      disabled={loadingExplanation}
                    >
                      {loadingExplanation ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-sm">Explaining...</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <CircleHelp className="w-4 h-4" />
                          <span className="text-sm">Explain Query</span>
                        </div>
                      )}
                    </Button>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    Click &quot;Explain Query&quot; for SQL explanations
                  </div>
                </div>
              </div>
            )
          ) : (
            <div className="flex items-center justify-between">
              <span className="flex-1 pr-4">
                {activeQuery.slice(0, activeQueryCutoff)}
                {activeQuery.length > activeQueryCutoff ? "..." : ""}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyQuery}
                  className="h-8 px-2 hover:bg-muted-foreground/10 transition-all duration-200 hover:scale-105"
                  aria-label="Copy SQL query"
                >
                  {copied ? (
                    <div className="flex items-center gap-1 text-green-600">
                      <Check className="w-4 h-4" />
                      <span className="text-xs font-medium">Copied!</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
                      <Copy className="w-4 h-4" />
                      <span className="text-xs font-medium">Copy</span>
                    </div>
                  )}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setQueryExpanded(true)}
                  className="h-8 px-2 text-xs hover:scale-105 transition-all duration-200"
                >
                  Expand
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
      {/* {!queryExpanded && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setQueryExpanded(true)}
          className="absolute inset-0 h-full transition-opacity duration-300 ease-in-out opacity-0 group-hover:opacity-100"
        >
          Show full query
        </Button>
      )} */}
    </div>
  );
};
