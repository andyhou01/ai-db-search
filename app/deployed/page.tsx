"use client";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import {
  ChatHistoryItem,
  getChatHistory,
  clearChatHistory,
  deleteHistoryItem,
} from "@/lib/chat-history";
import { Results } from "@/components/results";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import {
  Trash2,
  Eye,
  Code,
  Download,
  Search,
  SortAsc,
  SortDesc,
  Filter,
  X,
  Loader2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { QueryViewer } from "@/components/query-viewer";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { generateChartConfig } from "@/actions/dbQuery";

type SortField = "query" | "timestamp" | "results" | "connection";
type SortOrder = "asc" | "desc";

const DeployedPage = () => {
  const [history, setHistory] = useState<ChatHistoryItem[]>([]);
  const [filteredHistory, setFilteredHistory] = useState<ChatHistoryItem[]>([]);
  const [selectedHistoryItem, setSelectedHistoryItem] =
    useState<ChatHistoryItem | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isQueryDialogOpen, setIsQueryDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("timestamp");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [connectionFilter, setConnectionFilter] = useState<string[]>([]);
  const [availableConnections, setAvailableConnections] = useState<string[]>(
    []
  );
  const [chartConfig, setChartConfig] = useState<any>(null);
  const [isChartLoading, setIsChartLoading] = useState(false);

  useEffect(() => {
    // Load chat history when component mounts
    const chatHistory = getChatHistory();
    setHistory(chatHistory);

    // Extract unique connections for filtering
    const connections = [
      ...new Set(chatHistory.map((item) => item.connection)),
    ].filter(Boolean);
    setAvailableConnections(connections);
  }, []);

  // Apply filters and sorting
  useEffect(() => {
    let filtered = [...history];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.query.toLowerCase().includes(query) ||
          item.sqlQuery.toLowerCase().includes(query)
      );
    }

    // Apply connection filter
    if (connectionFilter.length > 0) {
      filtered = filtered.filter((item) =>
        connectionFilter.includes(item.connection)
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "query":
          comparison = a.query.localeCompare(b.query);
          break;
        case "timestamp":
          comparison = a.timestamp - b.timestamp;
          break;
        case "results":
          comparison = a.results.length - b.results.length;
          break;
        case "connection":
          comparison = (a.connection || "").localeCompare(b.connection || "");
          break;
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });

    setFilteredHistory(filtered);
  }, [history, searchQuery, sortField, sortOrder, connectionFilter]);

  const handleClearHistory = () => {
    clearChatHistory();
    setHistory([]);
    setFilteredHistory([]);
    setSelectedHistoryItem(null);
  };

  const handleSelectHistoryItem = (item: ChatHistoryItem) => {
    setSelectedHistoryItem(item);
    setIsDialogOpen(true);
    generateChart(item);
  };

  const handleViewSQLQuery = (item: ChatHistoryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedHistoryItem(item);
    setIsQueryDialogOpen(true);
  };

  const handleDeleteClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering row selection
    setItemToDelete(id);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (itemToDelete) {
      const updatedHistory = deleteHistoryItem(itemToDelete);
      setHistory(updatedHistory);

      // If the deleted item was selected, clear the selection
      if (selectedHistoryItem?.id === itemToDelete) {
        setSelectedHistoryItem(null);
        setIsDialogOpen(false);
      }

      setItemToDelete(null);
    }
    setIsDeleteDialogOpen(false);
  };

  const cancelDelete = () => {
    setItemToDelete(null);
    setIsDeleteDialogOpen(false);
  };

  const formatTimestamp = (timestamp: number) => {
    return formatDistanceToNow(timestamp, { addSuffix: true });
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const toggleConnectionFilter = (connection: string) => {
    setConnectionFilter((prev) => {
      if (prev.includes(connection)) {
        return prev.filter((c) => c !== connection);
      } else {
        return [...prev, connection];
      }
    });
  };

  const clearFilters = () => {
    setSearchQuery("");
    setConnectionFilter([]);
    setSortField("timestamp");
    setSortOrder("desc");
  };

  const downloadCSV = (item: ChatHistoryItem) => {
    if (item.results.length === 0) return;

    // Create CSV header row
    const header = item.columns.join(",");

    // Create CSV rows from data
    const csvRows = item.results.map((row) => {
      return item.columns
        .map((column) => {
          let value = row[column as keyof typeof row];

          if (typeof value === "string" && value.includes(",")) {
            return `"${value}"`;
          }

          return value !== undefined ? String(value) : "";
        })
        .join(",");
    });

    // Combine header and rows
    const csvContent = [header, ...csvRows].join("\n");

    // Create a blob and download link
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `query-results-${item.id}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Function to generate chart config when viewing results
  const generateChart = async (item: ChatHistoryItem) => {
    if (!item || item.results.length === 0) return;

    setIsChartLoading(true);
    try {
      const generation = await generateChartConfig(item.results, item.query);
      setChartConfig(generation.config);
    } catch (error) {
      console.error("Failed to generate chart:", error);
    } finally {
      setIsChartLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Query History</h1>
        {/* {history.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearHistory}
            className="flex items-center gap-1"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Clear History
          </Button>
        )} */}
      </div>

      {history.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground py-8">
              No query history available. Run some queries to see them here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-0">
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search queries..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 w-full"
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1 h-7 w-7 p-0"
                    onClick={() => setSearchQuery("")}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <div className="flex gap-2 w-full sm:w-auto">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-1"
                    >
                      <Filter className="h-4 w-4 mr-1" />
                      Filter
                      {connectionFilter.length > 0 && (
                        <Badge variant="secondary" className="ml-1">
                          {connectionFilter.length}
                        </Badge>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem onClick={clearFilters}>
                      Clear all filters
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {availableConnections.map((connection) => (
                      <DropdownMenuCheckboxItem
                        key={connection}
                        checked={connectionFilter.includes(connection)}
                        onCheckedChange={() =>
                          toggleConnectionFilter(connection)
                        }
                      >
                        {connection || "Unknown"}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-1"
                    >
                      {sortOrder === "asc" ? (
                        <SortAsc className="h-4 w-4 mr-1" />
                      ) : (
                        <SortDesc className="h-4 w-4 mr-1" />
                      )}
                      Sort
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => toggleSort("query")}>
                      Query{" "}
                      {sortField === "query" &&
                        (sortOrder === "asc" ? "↑" : "↓")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => toggleSort("timestamp")}>
                      Time{" "}
                      {sortField === "timestamp" &&
                        (sortOrder === "asc" ? "↑" : "↓")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => toggleSort("results")}>
                      Results{" "}
                      {sortField === "results" &&
                        (sortOrder === "asc" ? "↑" : "↓")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => toggleSort("connection")}>
                      Connection{" "}
                      {sortField === "connection" &&
                        (sortOrder === "asc" ? "↑" : "↓")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0 pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[35%]">Query</TableHead>
                  <TableHead className="w-[15%]">Time</TableHead>
                  <TableHead className="w-[15%]">Connection</TableHead>
                  <TableHead className="w-[15%]">Result Size</TableHead>
                  <TableHead className="w-[20%] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredHistory.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No matching queries found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredHistory.map((item) => (
                    <TableRow
                      key={item.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSelectHistoryItem(item)}
                    >
                      <TableCell className="font-medium truncate max-w-xs">
                        {item.query}
                      </TableCell>
                      <TableCell>{formatTimestamp(item.timestamp)}</TableCell>
                      <TableCell>
                        {item.connection ? (
                          <Badge variant="outline">{item.connection}</Badge>
                        ) : (
                          <span className="text-muted-foreground">Unknown</span>
                        )}
                      </TableCell>
                      <TableCell>{item.results.length} rows</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectHistoryItem(item);
                            }}
                            className="h-8 w-8 p-0"
                            title="View Results"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => handleViewSQLQuery(item, e)}
                            className="h-8 w-8 p-0"
                            title="View SQL Query"
                          >
                            <Code className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadCSV(item);
                            }}
                            className="h-8 w-8 p-0"
                            title="Download Results"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => handleDeleteClick(item.id, e)}
                            className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this query history item. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelDelete}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Results Dialog - With chart support */}
      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setChartConfig(null); // Clear chart config when closing dialog
          }
        }}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{selectedHistoryItem?.query}</DialogTitle>
            <CardDescription className="flex flex-col sm:flex-row sm:items-center gap-2 mt-1">
              <span>
                {selectedHistoryItem &&
                  formatTimestamp(selectedHistoryItem.timestamp)}
              </span>
              {selectedHistoryItem?.connection && (
                <>
                  <span className="hidden sm:inline">•</span>
                  <Badge variant="outline">
                    {selectedHistoryItem.connection}
                  </Badge>
                </>
              )}
              {isChartLoading && (
                <span className="text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Generating chart...
                </span>
              )}
            </CardDescription>
          </DialogHeader>
          <div className="mt-4">
            {selectedHistoryItem && (
              <Results
                results={selectedHistoryItem.results}
                columns={selectedHistoryItem.columns}
                chartConfig={chartConfig}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Separate SQL Query Dialog */}
      <Dialog open={isQueryDialogOpen} onOpenChange={setIsQueryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>SQL Query</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            {selectedHistoryItem && (
              <QueryViewer
                activeQuery={selectedHistoryItem.sqlQuery}
                inputValue=""
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DeployedPage;
