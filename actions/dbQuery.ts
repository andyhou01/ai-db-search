"use server";

import { Config, configSchema, explanationsSchema, Result } from "@/lib/types";
import { DatabaseSchema } from "@/types/dataBase";
import { openai } from "@ai-sdk/openai";
import { createPool } from "@vercel/postgres";
import { generateObject } from "ai";
import { z } from "zod";

// Helper function to get SQL client with connection URL
const getSqlClient = (connectionUrl: string) => {
  return createPool({
    connectionString: connectionUrl,
  });
};

// New function to get database schema
export const getDatabaseSchema = async (connectionUrl: string) => {
  "use server";
  try {
    const client = getSqlClient(connectionUrl);

    // Query to get table information
    const tableQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    const tables = await client.query(tableQuery);

    let schema: DatabaseSchema = {
      tables: [],
    };

    // For each table, get column information
    for (const table of tables.rows) {
      const tableName = table.table_name;

      const columnQuery = `
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position
      `;

      const columns = await client.query(columnQuery, [tableName]);

      const tableSchema: DatabaseSchema["tables"][0] = {
        name: tableName,
        columns: [],
      };

      columns.rows.forEach((column) => {
        tableSchema.columns.push({
          name: column.column_name,
          type: column.data_type.toUpperCase(),
          nullable: column.is_nullable === "NO",
          default: column.column_default,
        });
      });

      schema.tables.push(tableSchema);
    }
    return schema;
  } catch (e) {
    console.error("Error fetching database schema:", e);
    return undefined;
  }
};

export const generateQuery = async (
  input: string,
  connectionUrl: string,
  existingSchema?: string
): Promise<
  | {
      error: true;
      message: string;
      issues?: string[];
      query?: string;
      details?: string;
    }
  | {
      error: false;
      query: string;
    }
> => {
  "use server";
  try {
    // Use existing schema if provided, otherwise fetch it
    const dbSchema = existingSchema || (await getDatabaseSchema(connectionUrl));

    // Use schema if available
    const schemaToUse = dbSchema;

    const result = await generateObject({
      model: openai("gpt-4o"),
      system: `You are a SQL (postgres) and data visualization expert. Your job is to help the user write a SQL query to retrieve the data they need. The table schema is as follows:

  ${schemaToUse}

  Only retrieval queries are allowed. Do not generate queries that modify data.

  IMPORTANT: Only use column names that actually exist in the schema above. Do not invent or assume column names that aren't explicitly defined in the schema. Double-check all column references against the schema before finalizing your query.

  You can use standard PostgreSQL functions like DATE_TRUNC, EXTRACT, TO_CHAR, etc. when appropriate for date/time manipulation and formatting. For example:
  - DATE_TRUNC('month', date_column) to truncate a date to the month level
  - EXTRACT(YEAR FROM date_column) to extract the year from a date
  - TO_CHAR(date_column, 'YYYY-MM') to format a date as year-month

  For string fields, use the ILIKE operator with wildcards and convert both the search term and the field to lowercase using LOWER() function for case-insensitive matching. For example: LOWER(column_name) ILIKE LOWER('%search_term%').

  When answering questions about specific entities, ensure you are selecting both the identifying column and the relevant data columns to provide context.

  For text fields that may contain comma-separated values, use string functions like TRIM() when comparing to ensure accurate results.

  If the user asks for temporal trends or data 'over time', group by the appropriate time unit (year, month, day) based on available date/timestamp columns. Use DATE_TRUNC to group by time periods. For example:
  - GROUP BY DATE_TRUNC('month', date_column)
  - GROUP BY DATE_TRUNC('year', date_column)
  - GROUP BY EXTRACT(YEAR FROM date_column)

  For abbreviations or acronyms in search terms, consider both the abbreviated and full forms in your query when appropriate.
  
  If the user asks for a rate, return it as a decimal. For example, 0.1 would be 10%.

  EVERY QUERY SHOULD RETURN QUANTITATIVE DATA THAT CAN BE PLOTTED ON A CHART! There should always be at least two columns. If the user asks for a single value, include a relevant grouping dimension or return a count alongside it.`,
      prompt: `Generate the query necessary to retrieve the data the user wants: ${input}`,
      schema: z.object({
        query: z.string(),
        validation: z
          .object({
            isValid: z.boolean(),
            issues: z.array(z.string()).optional(),
          })
          .optional(),
      }),
    });

    // If validation is provided and there are issues, return structured error info instead of throwing
    if (result.object.validation && !result.object.validation.isValid) {
      const issues = result.object.validation.issues || [
        "Unknown column name issue",
      ];
      return {
        error: true,
        message: `SQL query validation failed: ${issues.join(", ")}`,
        issues: issues,
        query: result.object.query, // Include the generated query for reference
      };
    }

    return { error: false, query: result.object.query };
  } catch (e) {
    console.error(e);
    return {
      error: true,
      message: "Failed to generate query",
      details: e instanceof Error ? e.message : String(e),
    };
  }
};

export const runGenerateSQLQuery = async (
  query: string,
  connectionUrl: string
) => {
  "use server";
  // Check if the query is a SELECT statement
  if (
    !query.trim().toLowerCase().startsWith("select") ||
    query.trim().toLowerCase().includes("drop") ||
    query.trim().toLowerCase().includes("delete") ||
    query.trim().toLowerCase().includes("insert") ||
    query.trim().toLowerCase().includes("update") ||
    query.trim().toLowerCase().includes("alter") ||
    query.trim().toLowerCase().includes("truncate") ||
    query.trim().toLowerCase().includes("create") ||
    query.trim().toLowerCase().includes("grant") ||
    query.trim().toLowerCase().includes("revoke")
  ) {
    throw new Error("Only SELECT queries are allowed");
  }

  // Validate the query against the schema
  const validation = await validateSqlQuery(query, connectionUrl);
  if (!validation.isValid) {
    // Return a structured error response with suggestions
    return {
      error: validation.error,
      suggestions: validation.suggestions || {},
      validColumns: validation.validColumns || [],
      suggestedTables: validation.suggestedTables || [],
    };
  }

  let data: any;
  try {
    const client = getSqlClient(connectionUrl);
    data = await client.query(query);
    return data.rows as Result[];
  } catch (e: any) {
    console.error("SQL query error:", e.message);

    if (
      e.message.includes("relation") &&
      e.message.includes("does not exist")
    ) {
      const tableMatch = e.message.match(/relation "([^"]+)" does not exist/);
      const tableName = tableMatch ? tableMatch[1] : "unknown table";

      // Get available tables for suggestions
      const schema = await getDatabaseSchema(connectionUrl);
      const availableTables = schema ? schema.tables.map((t) => t.name) : [];

      return {
        error: `Table '${tableName}' does not exist in the database.`,
        suggestedTables: availableTables,
      };
    } else if (
      e.message.includes("column") &&
      e.message.includes("does not exist")
    ) {
      // Extract the column name from the error message
      const columnMatch = e.message.match(/column "([^"]+)" does not exist/);
      const columnName = columnMatch ? columnMatch[1] : "unknown column";

      // Run validation again to get suggestions
      const validation = await validateSqlQuery(query, connectionUrl);

      return {
        error: `Column '${columnName}' does not exist in the database schema.`,
        suggestions: validation.suggestions || {},
        validColumns: validation.validColumns || [],
      };
    } else if (
      e.message.includes("function") &&
      e.message.includes("does not exist")
    ) {
      // Handle function not found errors
      const functionMatch = e.message.match(/function ([^\(]+)/);
      const functionName = functionMatch
        ? functionMatch[1].trim()
        : "unknown function";

      return {
        error: `Function '${functionName}' does not exist in PostgreSQL or is not available.`,
        functionError: true,
        suggestedFunctions: [
          "date_trunc",
          "extract",
          "to_char",
          "to_date",
          "date_part",
          "count",
          "sum",
          "avg",
          "min",
          "max",
        ],
      };
    } else {
      return {
        error: `SQL Error: ${e.message}`,
      };
    }
  }
};

export const explainQuery = async (
  input: string,
  sqlQuery: string,
  connectionUrl: string,
  existingSchema?: string
) => {
  "use server";
  try {
    // Use existing schema if provided, otherwise fetch it
    const dbSchema = existingSchema || (await getDatabaseSchema(connectionUrl));

    // Use schema if available
    const schemaToUse = dbSchema;

    const result = await generateObject({
      model: openai("gpt-4o"),
      schema: z.object({
        explanations: explanationsSchema,
      }),
      system: `You are a SQL (postgres) expert. Your job is to explain SQL queries in a clear, concise manner that helps users understand how the query works. The database schema is as follows:
    ${schemaToUse}

    Break down your explanation into logical sections of the query. For each section:
    1. Identify a distinct part of the query (SELECT clause, FROM clause, WHERE conditions, etc.)
    2. Explain what that section accomplishes in plain language
    3. If a section doesn't need explanation, include it but leave the explanation empty

    Focus on helping non-technical users understand the query logic without getting into advanced SQL concepts unless necessary.
    `,
      prompt: `Explain the SQL query you generated to retrieve the data the user wanted. Assume the user is not an expert in SQL. Break down the query into steps. Be concise.

      User Query:
      ${input}

      Generated SQL Query:
      ${sqlQuery}`,
    });
    return result.object;
  } catch (e) {
    console.error(e);
    throw new Error("Failed to generate query");
  }
};

export const generateChartConfig = async (
  results: Result[],
  userQuery: string
) => {
  "use server";

  try {
    const { object: config } = await generateObject({
      model: openai("gpt-4o"),
      system: `You are a data visualization expert specializing in selecting the most appropriate chart types for different data patterns. Your goal is to create visualizations that effectively communicate insights while being accessible and easy to interpret.

Choose chart types based on these principles:
- Bar charts for comparing discrete categories
- Line charts for temporal trends or continuous data
- Pie/donut charts only for showing composition when there are few categories
- Scatter plots for showing correlation between two variables
- Area charts for cumulative totals or part-to-whole relationships over time
- Multi-series charts when comparing multiple related metrics

Ensure your visualization choices prioritize clarity, minimize chart junk, and accurately represent the underlying data.`,
      prompt: `Given the following data from a SQL query result, generate the chart config that best visualises the data and answers the users query.
      For multiple groups use multi-lines.

      Here is an example complete config:
      export const chartConfig = {
        type: "pie",
        xKey: "month",
        yKeys: ["sales", "profit", "expenses"],
        colors: {
          sales: "#4CAF50",    // Green for sales
          profit: "#2196F3",   // Blue for profit
          expenses: "#F44336"  // Red for expenses
        },
        legend: true
      }

      User Query:
      ${userQuery}

      Data:
      ${JSON.stringify(results, null, 2)}`,
      schema: configSchema,
    });

    const colors: Record<string, string> = {};
    config.yKeys.forEach((key, index) => {
      colors[key] = `hsl(var(--chart-${index + 1}))`;
    });

    const updatedConfig: Config = { ...config, colors };
    return { config: updatedConfig };
  } catch (e) {
    // @ts-expect-errore
    console.error(e.message);
    throw new Error("Failed to generate chart suggestion");
  }
};

// Helper function to validate SQL query against schema
export const validateSqlQuery = async (
  query: string,
  connectionUrl: string
) => {
  "use server";
  try {
    // Get the database schema
    const schema = await getDatabaseSchema(connectionUrl);
    if (!schema) {
      return { isValid: false, error: "Could not retrieve database schema" };
    }

    // Filter out SQL keywords, functions, and aliases
    const sqlKeywords = [
      "select",
      "from",
      "where",
      "group",
      "by",
      "having",
      "order",
      "limit",
      "offset",
      "join",
      "inner",
      "outer",
      "left",
      "right",
      "on",
      "as",
      "and",
      "or",
      "not",
      "in",
      "between",
      "like",
      "is",
      "null",
      "asc",
      "desc",
      "distinct",
      "case",
      "when",
      "then",
      "else",
      "end",
      "count",
      "sum",
      "avg",
      "min",
      "max",
      "lower",
    ];

    // Common SQL functions that shouldn't be treated as column references
    const sqlFunctions = [
      "date_trunc",
      "date_part",
      "extract",
      "to_char",
      "to_date",
      "to_timestamp",
      "coalesce",
      "nullif",
      "greatest",
      "least",
      "concat",
      "substring",
      "trim",
      "upper",
      "lower",
      "initcap",
      "length",
      "replace",
      "round",
      "ceil",
      "floor",
      "abs",
      "random",
      "now",
      "current_date",
      "current_time",
      "current_timestamp",
      "date",
      "time",
      "timestamp",
      "interval",
      "cast",
      "row_number",
      "rank",
      "dense_rank",
      "lag",
      "lead",
      "first_value",
      "last_value",
      "nth_value",
      "string_agg",
      "array_agg",
      "json_agg",
      "json_build_object",
      "json_build_array",
      "jsonb_build_object",
      "jsonb_build_array",
    ];

    // Common function parameters that shouldn't be treated as column references
    const commonFunctionParams = [
      "year",
      "month",
      "day",
      "hour",
      "minute",
      "second",
      "millisecond",
      "quarter",
      "week",
      "decade",
      "century",
      "millennium",
      "isoyear",
      "epoch",
      "microseconds",
      "timezone",
    ];

    // Pre-process the query to handle function parameters
    // This will temporarily replace function calls and their parameters to avoid false positives
    let processedQuery = query;
    const functionCalls: string[] = [];

    // Find and extract function calls with their parameters
    const functionPattern = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(\s*([^)]*)\s*\)/g;
    let match;
    let index = 0;

    while ((match = functionPattern.exec(query)) !== null) {
      const fullMatch = match[0];
      const funcName = match[1];
      const params = match[2];

      // Skip if it's not a known SQL function
      if (!sqlFunctions.includes(funcName.toLowerCase())) continue;

      // Replace the function call with a placeholder
      const placeholder = `__FUNC_${index}__`;
      processedQuery = processedQuery.replace(fullMatch, placeholder);
      functionCalls.push(fullMatch);
      index++;
    }

    // Extract all column references from the processed query
    const columnMatches =
      processedQuery.match(
        /\b[a-zA-Z_][a-zA-Z0-9_]*\.[a-zA-Z_][a-zA-Z0-9_]*\b|\b[a-zA-Z_][a-zA-Z0-9_]*\b/g
      ) || [];

    // Extract table names from the query
    const fromMatch = query.match(/\bfrom\s+([a-zA-Z_][a-zA-Z0-9_]*)/i);
    const tableNames = fromMatch ? [fromMatch[1].toLowerCase()] : [];

    // Add tables from joins
    const joinMatches = query.match(/\bjoin\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi);
    if (joinMatches) {
      joinMatches.forEach((match) => {
        const tableName = match.replace(/\bjoin\s+/i, "").toLowerCase();
        if (!tableNames.includes(tableName)) {
          tableNames.push(tableName);
        }
      });
    }

    // Check if tables exist
    const invalidTables = tableNames.filter(
      (tableName) =>
        !schema.tables.some((table) => table.name.toLowerCase() === tableName)
    );

    if (invalidTables.length > 0) {
      return {
        isValid: false,
        error: `Table(s) not found: ${invalidTables.join(", ")}`,
        suggestedTables: schema.tables.map((t) => t.name),
      };
    }

    // Get all valid column names from the schema for the tables in the query
    const validColumns = new Set<string>();
    schema.tables.forEach((table) => {
      if (tableNames.includes(table.name.toLowerCase())) {
        table.columns.forEach((column) => {
          validColumns.add(column.name.toLowerCase());
          // Also add table.column format
          validColumns.add(
            `${table.name.toLowerCase()}.${column.name.toLowerCase()}`
          );
        });
      }
    });

    // Check each potential column reference
    const potentialColumns = columnMatches
      .filter((col) => !sqlKeywords.includes(col.toLowerCase()))
      .filter((col) => !sqlFunctions.includes(col.toLowerCase()))
      .filter((col) => !commonFunctionParams.includes(col.toLowerCase())) // Filter out common function parameters
      .filter((col) => !col.includes("(")) // Filter out function calls
      .filter((col) => !col.startsWith("__FUNC_")) // Filter out our function placeholders
      .map((col) => col.toLowerCase());

    const invalidColumns = potentialColumns.filter((col) => {
      // Skip checking table aliases and table names
      if (tableNames.includes(col)) return false;

      // Skip checking aliases defined in the query with "AS"
      const asPattern = new RegExp(`\\bas\\s+${col}\\b`, "i");
      if (query.match(asPattern)) return false;

      // Skip string literals (values in quotes)
      const stringLiteralPattern = new RegExp(`['"]${col}['"]`);
      if (query.match(stringLiteralPattern)) return false;

      return !validColumns.has(col);
    });

    if (invalidColumns.length > 0) {
      // Get suggestions for each invalid column
      const suggestions: Record<string, string[]> = {};

      invalidColumns.forEach((invalidCol) => {
        // Simple suggestion based on string similarity
        const allColumns = Array.from(validColumns);
        const similarColumns = allColumns
          .filter((validCol) => {
            const simpleValidCol = validCol.includes(".")
              ? validCol.split(".")[1]
              : validCol;
            return (
              simpleValidCol.length > 2 &&
              (invalidCol.includes(simpleValidCol) ||
                simpleValidCol.includes(invalidCol) ||
                levenshteinDistance(invalidCol, simpleValidCol) <= 3)
            );
          })
          .slice(0, 3); // Limit to top 3 suggestions

        suggestions[invalidCol] = similarColumns;
      });

      return {
        isValid: false,
        error: `Invalid column(s): ${invalidColumns.join(", ")}`,
        suggestions,
        validColumns: Array.from(validColumns),
      };
    }

    return { isValid: true };
  } catch (e: any) {
    console.error("Error validating SQL query:", e);
    return { isValid: false, error: `Error validating query: ${e.message}` };
  }
};

// Levenshtein distance for string similarity
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  // Initialize matrix
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}
