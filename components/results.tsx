import { Config, Result, Unicorn } from "@/lib/types";
import { DynamicChart } from "./dynamic-chart";
import { SkeletonCard } from "./skeleton-card";
import {
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
  Table,
} from "./ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { useState } from "react";
import { Button } from "./ui/button";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";

export const Results = ({
  results,
  columns,
  chartConfig,
  tableOnly = false,
}: {
  results: Result[];
  columns: string[];
  chartConfig: Config | null;
  tableOnly?: boolean;
}) => {
  // Add pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const totalPages = Math.ceil(results.length / itemsPerPage);

  // Calculate the current page's data
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = results.slice(indexOfFirstItem, indexOfLastItem);

  const formatColumnTitle = (title: string) => {
    return title
      .split("_")
      .map((word, index) =>
        index === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word
      )
      .join(" ");
  };

  const formatCellValue = (column: string, value: any) => {
    if (column.toLowerCase().includes("valuation")) {
      const parsedValue = parseFloat(value);
      if (isNaN(parsedValue)) {
        return "";
      }
      const formattedValue = parsedValue.toFixed(2);
      const trimmedValue = formattedValue.replace(/\.?0+$/, "");
      return `$${trimmedValue}B`;
    }
    if (column.toLowerCase().includes("rate")) {
      const parsedValue = parseFloat(value);
      if (isNaN(parsedValue)) {
        return "";
      }
      const percentage = (parsedValue * 100).toFixed(2);
      return `${percentage}%`;
    }
    if (value instanceof Date) {
      return value.toLocaleDateString();
    }
    return String(value);
  };

  // Pagination controls
  const goToNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  };

  const goToPrevPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  // Function to download results as CSV
  const downloadCSV = () => {
    if (results.length === 0) return;

    // Create CSV header row
    const header = columns.join(",");

    // Create CSV rows from data
    const csvRows = results.map((company) => {
      return columns
        .map((column) => {
          // Format the cell value for CSV
          let value = company[column as keyof Unicorn];

          // Handle special formatting for CSV
          if (typeof value === "string" && value.includes(",")) {
            // Escape commas in values by wrapping in quotes
            return `"${value}"`;
          }

          // Use the same formatting as displayed in the table
          return formatCellValue(column, value);
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
    link.setAttribute("download", "results.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-grow flex flex-col">
      {tableOnly ? (
        // Table-only view for data display
        <div className="flex-grow flex flex-col">
          <div className="flex justify-end mb-2">
            <Button
              variant="outline"
              size="sm"
              onClick={downloadCSV}
              disabled={results.length === 0}
              className="flex items-center gap-1"
            >
              <Download className="h-4 w-4" />
              Download CSV
            </Button>
          </div>
          <div className="sm:min-h-[10px] relative flex-grow overflow-hidden">
            <div className="overflow-x-auto">
              <Table className="min-w-full divide-y divide-border">
                <TableHeader className="bg-muted top-0 shadow-sm">
                  <TableRow>
                    {columns.map((column, index) => (
                      <TableHead
                        key={index}
                        className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider max-w-[200px] truncate"
                      >
                        {formatColumnTitle(column)}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody className="bg-card divide-y divide-border">
                  {currentItems.map((company, index) => (
                    <TableRow key={index} className="hover:bg-muted">
                      {columns.map((column, cellIndex) => (
                        <TableCell
                          key={cellIndex}
                          className="px-4 py-4 text-sm text-foreground max-w-[200px] truncate"
                          title={String(
                            formatCellValue(
                              column,
                              company[column as keyof Unicorn]
                            )
                          )}
                        >
                          {formatCellValue(
                            column,
                            company[column as keyof Unicorn]
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Pagination controls */}
          {results.length > itemsPerPage && (
            <div className="flex items-center justify-between pt-4">
              <div className="text-sm text-muted-foreground">
                Showing {indexOfFirstItem + 1}-
                {Math.min(indexOfLastItem, results.length)} of {results.length}{" "}
                results
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToPrevPage}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToNextPage}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        // Full view with tabs
        <Tabs defaultValue="table" className="w-full flex-grow flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="table">Table</TabsTrigger>
            <TabsTrigger
              value="charts"
              disabled={
                Object.keys(results[0] || {}).length <= 1 || results.length < 2
              }
            >
              Chart
            </TabsTrigger>
          </TabsList>
          <TabsContent value="table" className="flex-grow flex flex-col">
            <div className="flex justify-end mb-2">
              <Button
                variant="outline"
                size="sm"
                onClick={downloadCSV}
                disabled={results.length === 0}
                className="flex items-center gap-1"
              >
                <Download className="h-4 w-4" />
                Download CSV
              </Button>
            </div>
            <div className="sm:min-h-[10px] relative flex-grow">
              <Table className="min-w-full divide-y divide-border">
                <TableHeader className="bg-muted top-0 shadow-sm">
                  <TableRow>
                    {columns.map((column, index) => (
                      <TableHead
                        key={index}
                        className="px-6 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider"
                      >
                        {formatColumnTitle(column)}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody className="bg-card divide-y divide-border">
                  {currentItems.map((company, index) => (
                    <TableRow key={index} className="hover:bg-muted">
                      {columns.map((column, cellIndex) => (
                        <TableCell
                          key={cellIndex}
                          className="px-6 py-4 whitespace-nowrap text-sm text-foreground"
                        >
                          {formatCellValue(
                            column,
                            company[column as keyof Unicorn]
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination controls */}
            {results.length > itemsPerPage && (
              <div className="flex items-center justify-between pt-4">
                <div className="text-sm text-muted-foreground">
                  Showing {indexOfFirstItem + 1}-
                  {Math.min(indexOfLastItem, results.length)} of{" "}
                  {results.length} results
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goToPrevPage}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goToNextPage}
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>
          <TabsContent value="charts" className="flex-grow overflow-auto">
            <div className="mt-4">
              {chartConfig && results.length > 0 ? (
                <DynamicChart chartData={results} chartConfig={chartConfig} />
              ) : (
                <SkeletonCard />
              )}
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};
