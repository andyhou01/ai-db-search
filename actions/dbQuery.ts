"use server";

import { Config, configSchema, explanationsSchema, Result } from "@/lib/types";
import {
  DatabaseSchema,
  EnhancedDatabaseSchema,
  TableSummary,
  ColumnSummary,
} from "@/types/dataBase";
import { openai } from "@ai-sdk/openai";
import { Client } from "pg";
import { generateObject } from "ai";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";

// Helper function to get SQL client with connection URL
const getSqlClient = (connectionUrl: string) => {
  return new Client({
    connectionString: connectionUrl,
    ssl: connectionUrl.includes(".postgres.database.azure.com")
      ? { rejectUnauthorized: false }
      : undefined,
    connectionTimeoutMillis: 8000,
    query_timeout: 10000,
  });
};

// New function to get database schema
export const getDatabaseSchema = async (connectionUrl: string) => {
  "use server";
  let client: Client | null = null;

  try {
    client = getSqlClient(connectionUrl);
    await client.connect();

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
  } finally {
    if (client) {
      try {
        await client.end();
      } catch (e) {
        console.warn("Error closing client connection:", e);
      }
    }
  }
};

// Enhanced function to get database schema with table summaries
export const getEnhancedDatabaseSchema = async (
  connectionUrl: string,
  connectionName: string
) => {
  "use server";
  let client: Client | null = null;

  try {
    client = getSqlClient(connectionUrl);
    await client.connect();

    // First get the basic schema
    const basicSchema = await getDatabaseSchema(connectionUrl);
    if (!basicSchema) {
      throw new Error("Failed to get basic schema");
    }

    const tableSummaries: TableSummary[] = [];

    // For each table, get detailed summary information
    for (const table of basicSchema.tables) {
      const tableName = table.name;
      console.log(`Analyzing table: ${tableName}`);

      // Get row count
      const rowCountQuery = `SELECT COUNT(*) as count FROM "${tableName}"`;
      const rowCountResult = await client.query(rowCountQuery);
      const rowCount = parseInt(rowCountResult.rows[0].count);

      const columnSummaries: ColumnSummary[] = [];

      // For each column, get summary statistics
      for (const column of table.columns) {
        const columnName = column.name;
        const columnType = column.type.toLowerCase();

        const columnSummary: ColumnSummary = {
          name: column.name,
          type: column.type,
          nullable: column.nullable,
          default: column.default,
        };

        try {
          // Get null count and total count
          const nullCountQuery = `
            SELECT 
              COUNT(*) as total_count,
              COUNT(CASE WHEN "${columnName}" IS NULL THEN 1 END) as null_count
            FROM "${tableName}"
          `;
          const nullCountResult = await client.query(nullCountQuery);
          const totalCount = parseInt(nullCountResult.rows[0].total_count);
          const nullCount = parseInt(nullCountResult.rows[0].null_count);

          columnSummary.summary = {
            nullCount,
            totalCount,
          };

          // Handle different column types
          if (
            columnType.includes("varchar") ||
            columnType.includes("text") ||
            columnType.includes("char")
          ) {
            // For text columns, get distinct values and top values
            if (
              columnName.toLowerCase() !== "id" &&
              !columnName.toLowerCase().includes("_id")
            ) {
              try {
                const distinctQuery = `
                  SELECT 
                    "${columnName}" as value,
                    COUNT(*) as count
                  FROM "${tableName}"
                  WHERE "${columnName}" IS NOT NULL
                  GROUP BY "${columnName}"
                  ORDER BY COUNT(*) DESC
                  LIMIT 20
                `;
                const distinctResult = await client.query(distinctQuery);

                columnSummary.summary.topValues = distinctResult.rows.map(
                  (row) => ({
                    value: String(row.value),
                    count: parseInt(row.count),
                  })
                );

                // If we have 20 or fewer distinct values, also store them as distinctValues
                if (distinctResult.rows.length <= 20) {
                  columnSummary.summary.distinctValues =
                    distinctResult.rows.map((row) => String(row.value));
                }
              } catch (error) {
                console.warn(
                  `Error getting distinct values for ${tableName}.${columnName}:`,
                  error
                );
              }
            }
          } else if (
            columnType.includes("int") ||
            columnType.includes("decimal") ||
            columnType.includes("numeric") ||
            columnType.includes("float") ||
            columnType.includes("double") ||
            columnType.includes("real")
          ) {
            // For numerical columns, get statistical summary
            try {
              const statsQuery = `
                SELECT 
                  MIN("${columnName}") as min_val,
                  MAX("${columnName}") as max_val,
                  AVG("${columnName}") as mean_val,
                  STDDEV("${columnName}") as std_dev,
                  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "${columnName}") as median_val
                FROM "${tableName}"
                WHERE "${columnName}" IS NOT NULL
              `;
              const statsResult = await client.query(statsQuery);

              if (statsResult.rows.length > 0) {
                const stats = statsResult.rows[0];
                columnSummary.summary.min = stats.min_val
                  ? parseFloat(stats.min_val)
                  : null;
                columnSummary.summary.max = stats.max_val
                  ? parseFloat(stats.max_val)
                  : null;
                columnSummary.summary.mean = stats.mean_val
                  ? parseFloat(stats.mean_val)
                  : null;
                columnSummary.summary.median = stats.median_val
                  ? parseFloat(stats.median_val)
                  : null;
                columnSummary.summary.stdDev = stats.std_dev
                  ? parseFloat(stats.std_dev)
                  : null;
              }
            } catch (error) {
              console.warn(
                `Error getting stats for ${tableName}.${columnName}:`,
                error
              );
            }
          } else if (
            columnType.includes("date") ||
            columnType.includes("timestamp")
          ) {
            // For date columns, get min and max dates
            try {
              const dateStatsQuery = `
                SELECT 
                  MIN("${columnName}") as min_date,
                  MAX("${columnName}") as max_date
                FROM "${tableName}"
                WHERE "${columnName}" IS NOT NULL
              `;
              const dateStatsResult = await client.query(dateStatsQuery);

              if (dateStatsResult.rows.length > 0) {
                const stats = dateStatsResult.rows[0];
                columnSummary.summary.min = stats.min_date;
                columnSummary.summary.max = stats.max_date;
              }
            } catch (error) {
              console.warn(
                `Error getting date stats for ${tableName}.${columnName}:`,
                error
              );
            }
          } else if (columnType.includes("bool")) {
            // For boolean columns, get value distribution
            try {
              const boolQuery = `
                SELECT 
                  "${columnName}" as value,
                  COUNT(*) as count
                FROM "${tableName}"
                WHERE "${columnName}" IS NOT NULL
                GROUP BY "${columnName}"
                ORDER BY COUNT(*) DESC
              `;
              const boolResult = await client.query(boolQuery);

              columnSummary.summary.topValues = boolResult.rows.map((row) => ({
                value: String(row.value),
                count: parseInt(row.count),
              }));
            } catch (error) {
              console.warn(
                `Error getting boolean stats for ${tableName}.${columnName}:`,
                error
              );
            }
          }
        } catch (error) {
          console.warn(
            `Error analyzing column ${tableName}.${columnName}:`,
            error
          );
        }

        columnSummaries.push(columnSummary);
      }

      tableSummaries.push({
        name: tableName,
        rowCount,
        columns: columnSummaries,
      });
    }

    const enhancedSchema: EnhancedDatabaseSchema = {
      basicSchema,
      tableSummaries,
      connectionName,
      lastUpdated: new Date().toISOString(),
    };

    // Save the enhanced schema to a JSON file
    const dataDir = path.join(process.cwd(), "data");
    await fs.mkdir(dataDir, { recursive: true });
    const filePath = path.join(dataDir, `${connectionName}.json`);
    await fs.writeFile(filePath, JSON.stringify(enhancedSchema, null, 2));

    console.log(`Enhanced schema saved to: ${filePath}`);

    return enhancedSchema;
  } catch (e) {
    console.error("Error fetching enhanced database schema:", e);
    return undefined;
  } finally {
    if (client) {
      try {
        await client.end();
      } catch (e) {
        console.warn("Error closing client connection:", e);
      }
    }
  }
};

// Helper function to load enhanced schema from file
export const loadEnhancedSchema = async (
  connectionName: string
): Promise<EnhancedDatabaseSchema | undefined> => {
  "use server";
  try {
    const filePath = path.join(process.cwd(), "data", `${connectionName}.json`);
    const fileContent = await fs.readFile(filePath, "utf-8");
    return JSON.parse(fileContent) as EnhancedDatabaseSchema;
  } catch (error) {
    console.log(`No enhanced schema found for connection: ${connectionName}`);
    return undefined;
  }
};

// Helper function to ensure a query has a LIMIT clause
export const ensureQueryHasLimit = async (
  query: string,
  defaultLimit: number = 100
): Promise<string> => {
  "use server";
  const normalizedQuery = query.toLowerCase();

  // Check if the query already has a LIMIT clause
  if (/\blimit\s+\d+/i.test(normalizedQuery)) {
    return query; // Return original if it already has LIMIT
  }

  // Add LIMIT clause to the query
  return query.endsWith(";")
    ? query.slice(0, -1) + ` LIMIT ${defaultLimit};`
    : query + ` LIMIT ${defaultLimit};`;
};

export const generateQuery = async (
  input: string,
  connectionUrl: string,
  existingSchema?: string,
  defaultLimit: number = 100,
  connectionName?: string,
  maxRetries: number = 3
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

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Try to load enhanced schema first if connection name is provided
      let enhancedSchema: EnhancedDatabaseSchema | undefined;
      if (connectionName) {
        enhancedSchema = await loadEnhancedSchema(connectionName);
      }

      // Use existing schema if provided, otherwise use cached schema if available, or fetch basic schema as last resort
      let dbSchema;
      if (existingSchema) {
        dbSchema = existingSchema;
      } else if (enhancedSchema) {
        // Use the cached basic schema from enhanced schema instead of fetching from DB
        dbSchema = enhancedSchema.basicSchema;
        console.log(`Using cached schema for connection: ${connectionName}`);
      } else {
        // Only fetch from database if no cached data is available
        console.log(
          `No cached schema found, fetching from database for connection: ${
            connectionName || "unnamed"
          }`
        );
        dbSchema = await getDatabaseSchema(connectionUrl);
      }

      // Prepare schema information for the AI model
      let schemaToUse = dbSchema;
      let additionalContext = "";

      // If we have enhanced schema, include table summaries in the context
      if (enhancedSchema) {
        additionalContext = `\n\nTable Summaries (for better understanding of data):\n`;

        enhancedSchema.tableSummaries.forEach((table) => {
          additionalContext += `\n${table.name} (${table.rowCount} rows):\n`;

          table.columns.forEach((column: any) => {
            if (column.summary) {
              const summary = column.summary;
              additionalContext += `  - ${column.name} (${column.type}): `;

              if (
                summary.distinctValues &&
                summary.distinctValues.length <= 20
              ) {
                additionalContext += `Distinct values: ${summary.distinctValues.join(
                  ", "
                )}`;
              } else if (summary.topValues && summary.topValues.length > 0) {
                const topVals = summary.topValues
                  .slice(0, 5)
                  .map((v: any) => `${v.value}(${v.count})`)
                  .join(", ");
                additionalContext += `Top values: ${topVals}`;
              }

              if (summary.min !== undefined && summary.max !== undefined) {
                additionalContext += ` Range: ${summary.min} to ${summary.max}`;
              }

              if (summary.mean !== undefined && summary.mean !== null) {
                additionalContext += ` Mean: ${summary.mean.toFixed(2)}`;
              }

              if (
                summary.nullCount !== undefined &&
                summary.totalCount !== undefined
              ) {
                const nullPercent = (
                  (summary.nullCount / summary.totalCount) *
                  100
                ).toFixed(1);
                additionalContext += ` (${nullPercent}% null)`;
              }

              additionalContext += `\n`;
            }
          });
        });
      }

      const result = await generateObject({
        model: openai("gpt-4o"),
        system: `You are a SQL (postgres) and data visualization expert. Your job is to help the user write a SQL query to retrieve the data they need. The table schema is as follows:

    ${schemaToUse}${additionalContext}

    Only retrieval queries are allowed. Do not generate queries that modify data.

    IMPORTANT: Only use column names that actually exist in the schema above. Do not invent or assume column names that aren't explicitly defined in the schema. Double-check all column references against the schema before finalizing your query.

    When you have table summaries available, use them to:
    - Choose appropriate WHERE clauses based on actual data values
    - Understand the data distribution for better aggregations
    - Use actual category values when filtering text columns
    - Consider the data ranges when creating meaningful groupings

    You can use standard PostgreSQL functions like DATE_TRUNC, EXTRACT, TO_CHAR, etc. when appropriate for date/time manipulation and formatting. For example:
    - DATE_TRUNC('month', date_column) to truncate a date to the month level
    - EXTRACT(YEAR FROM date_column) to extract the year from a date
    - TO_CHAR(date_column, 'YYYY-MM') to format a date as year-month
    - TO_CHAR(date_column, 'YYYY-MM-DD') to format a date as YYYY-MM-DD for better chart readability

    IMPORTANT FOR DATES: When selecting date or timestamp columns that will be used as x-axis values in charts, always format them using TO_CHAR() or DATE_TRUNC() to make them human-readable. Avoid returning raw timestamps or epoch values. Examples:
    - SELECT TO_CHAR(date_column, 'YYYY-MM-DD') as day, COUNT(*) FROM table GROUP BY day
    - SELECT DATE_TRUNC('day', timestamp_column) as day, COUNT(*) FROM table GROUP BY day
    - SELECT TO_CHAR(created_at, 'Mon DD') as date_label, COUNT(*) FROM table GROUP BY date_label ORDER BY MIN(created_at)

    For string fields, use the ILIKE operator with wildcards and convert both the search term and the field to lowercase using LOWER() function for case-insensitive matching. For example: LOWER(column_name) ILIKE LOWER('%search_term%').

    When answering questions about specific entities, ensure you are selecting both the identifying column and the relevant data columns to provide context.

    For text fields that may contain comma-separated values, use string functions like TRIM() when comparing to ensure accurate results.

    If the user asks for temporal trends or data 'over time', group by the appropriate time unit (year, month, day) based on available date/timestamp columns. Use DATE_TRUNC to group by time periods. For example:
    - GROUP BY DATE_TRUNC('month', date_column)
    - GROUP BY DATE_TRUNC('year', date_column)
    - GROUP BY EXTRACT(YEAR FROM date_column)

    For abbreviations or acronyms in search terms, consider both the abbreviated and full forms in your query when appropriate.
    
    If the user asks for a rate, return it as a decimal. For example, 0.1 would be 10%.

    EVERY QUERY SHOULD RETURN QUANTITATIVE DATA THAT CAN BE PLOTTED ON A CHART! There should always be at least two columns. If the user asks for a single value, include a relevant grouping dimension or return a count alongside it.
    
    IMPORTANT: Always include a LIMIT clause in your query to prevent returning too many rows. Use LIMIT ${defaultLimit} by default unless the user specifically asks for more or fewer results.`,
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

      // Ensure the query has a LIMIT clause
      const finalQuery = await ensureQueryHasLimit(result.object.query);

      return { error: false, query: finalQuery };
    } catch (e: any) {
      console.error(
        `Query generation attempt ${attempt + 1} failed:`,
        e.message
      );

      // Check if it's a rate limit error
      if (e.message && e.message.includes("Rate limit reached")) {
        if (attempt < maxRetries - 1) {
          // Extract wait time from error message, or use exponential backoff
          const waitMatch = e.message.match(/try again in ([\d.]+)s/);
          const waitTime = waitMatch
            ? parseFloat(waitMatch[1]) * 1000
            : Math.pow(2, attempt) * 1000;

          console.log(
            `Rate limit hit, waiting ${waitTime}ms before retry ${
              attempt + 2
            }/${maxRetries}`
          );
          await sleep(waitTime);
          continue;
        }
      }

      // If it's the last attempt or not a rate limit error, return error
      if (attempt === maxRetries - 1) {
        return {
          error: true,
          message: "Failed to generate query after multiple attempts",
          details: e instanceof Error ? e.message : String(e),
        };
      }
    }
  }

  // This should never be reached, but TypeScript requires it
  return {
    error: true,
    message: "Unexpected error in query generation",
  };
};

export const runGenerateSQLQuery = async (
  query: string,
  connectionUrl: string
) => {
  "use server";

  // First, ensure the query has a LIMIT clause
  const safeQuery = await ensureQueryHasLimit(query);

  // Check if the query is a SELECT statement
  if (
    !safeQuery.trim().toLowerCase().startsWith("select") ||
    safeQuery.trim().toLowerCase().includes("drop") ||
    safeQuery.trim().toLowerCase().includes("delete") ||
    safeQuery.trim().toLowerCase().includes("insert") ||
    safeQuery.trim().toLowerCase().includes("update") ||
    safeQuery.trim().toLowerCase().includes("alter") ||
    safeQuery.trim().toLowerCase().includes("truncate") ||
    safeQuery.trim().toLowerCase().includes("create") ||
    safeQuery.trim().toLowerCase().includes("grant") ||
    safeQuery.trim().toLowerCase().includes("revoke")
  ) {
    throw new Error("Only SELECT queries are allowed");
  }

  let data: any;
  let client: Client | null = null;

  try {
    client = getSqlClient(connectionUrl);
    await client.connect();
    data = await client.query(safeQuery);
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
  } finally {
    if (client) {
      try {
        await client.end();
      } catch (e) {
        console.warn("Error closing client connection:", e);
      }
    }
  }
};

export const explainQuery = async (
  input: string,
  sqlQuery: string,
  connectionUrl: string,
  existingSchema?: string,
  connectionName?: string,
  maxRetries: number = 3
) => {
  "use server";

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Try to load enhanced schema first if connection name is provided
      let enhancedSchema: EnhancedDatabaseSchema | undefined;
      if (connectionName) {
        enhancedSchema = await loadEnhancedSchema(connectionName);
      }

      // Use existing schema if provided, otherwise use cached schema if available, or fetch from database as last resort
      let dbSchema;
      if (existingSchema) {
        dbSchema = existingSchema;
      } else if (enhancedSchema) {
        // Use the cached basic schema from enhanced schema instead of fetching from DB
        dbSchema = enhancedSchema.basicSchema;
        console.log(`Using cached schema for explanation: ${connectionName}`);
      } else {
        // Only fetch from database if no cached data is available
        console.log(
          `No cached schema found for explanation, fetching from database`
        );
        dbSchema = await getDatabaseSchema(connectionUrl);
      }

      // Use schema if available
      let schemaToUse = dbSchema;
      let additionalContext = "";

      // If we have enhanced schema, include simplified table summaries for context
      if (enhancedSchema) {
        additionalContext = `\n\nTable Context:\n`;
        enhancedSchema.tableSummaries.forEach((table) => {
          additionalContext += `${table.name} (${table.rowCount} rows), `;
        });
        additionalContext = additionalContext.slice(0, -2); // Remove trailing comma
      }

      const result = await generateObject({
        model: openai("gpt-4o"),
        schema: z.object({
          explanations: explanationsSchema,
        }),
        system: `You are a SQL (postgres) expert. Your job is to explain SQL queries in a clear, concise manner that helps users understand how the query works. The database schema is as follows:
      ${schemaToUse}${additionalContext}

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
    } catch (e: any) {
      console.error(
        `Query explanation attempt ${attempt + 1} failed:`,
        e.message
      );

      // Check if it's a rate limit error
      if (e.message && e.message.includes("Rate limit reached")) {
        if (attempt < maxRetries - 1) {
          // Extract wait time from error message, or use exponential backoff
          const waitMatch = e.message.match(/try again in ([\d.]+)s/);
          const waitTime = waitMatch
            ? parseFloat(waitMatch[1]) * 1000
            : Math.pow(2, attempt) * 1000;

          console.log(
            `Rate limit hit, waiting ${waitTime}ms before retry ${
              attempt + 2
            }/${maxRetries}`
          );
          await sleep(waitTime);
          continue;
        }
      }

      // If it's the last attempt or not a rate limit error, throw
      if (attempt === maxRetries - 1) {
        throw new Error(
          "Failed to generate query explanation after multiple attempts"
        );
      }
    }
  }
};

// Helper function to sleep for a given number of milliseconds
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const generateChartConfig = async (
  results: Result[],
  userQuery: string,
  maxRetries: number = 3
) => {
  "use server";

  for (let attempt = 0; attempt < maxRetries; attempt++) {
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

When dealing with date/time data:
- Always use line or area charts for time series data
- Ensure the x-axis field contains dates or timestamps
- Consider the temporal nature of the data in your visualization choice

Ensure your visualization choices prioritize clarity, minimize chart junk, and accurately represent the underlying data.`,
        prompt: `Given the following data from a SQL query result, generate the chart config that best visualises the data and answers the users query.
        For multiple groups use multi-lines.
        
        IMPORTANT: If the x-axis field contains dates, timestamps, or time-related data, make sure to use "line" or "area" chart types for better temporal visualization.

        Here is an example complete config:
        export const chartConfig = {
          type: "line", // Use "line" for time series data
          xKey: "day", // This should be the date/time field
          yKeys: ["count"],
          colors: {
            count: "#4CAF50"
          },
          legend: true,
          title: "UAE Sovereign Policies Compliance Changes Over a Week",
          description: "Shows how compliance states changed day by day"
        }

        User Query:
        ${userQuery}

        Data Sample (first few rows):
        ${JSON.stringify(results.slice(0, 5), null, 2)}
        
        Data Structure Analysis:
        - Total rows: ${results.length}
        - Column names: ${Object.keys(results[0] || {}).join(", ")}
        - Sample values: ${Object.entries(results[0] || {})
          .map(([key, value]) => `${key}: ${value}`)
          .join(", ")}`,
        schema: configSchema,
      });

      const colors: Record<string, string> = {};
      config.yKeys.forEach((key, index) => {
        colors[key] = `hsl(var(--chart-${index + 1}))`;
      });

      const updatedConfig: Config = { ...config, colors };
      return { config: updatedConfig };
    } catch (e: any) {
      console.error(
        `Chart config generation attempt ${attempt + 1} failed:`,
        e.message
      );

      // Check if it's a rate limit error
      if (e.message && e.message.includes("Rate limit reached")) {
        if (attempt < maxRetries - 1) {
          // Extract wait time from error message, or use exponential backoff
          const waitMatch = e.message.match(/try again in ([\d.]+)s/);
          const waitTime = waitMatch
            ? parseFloat(waitMatch[1]) * 1000
            : Math.pow(2, attempt) * 1000;

          console.log(
            `Rate limit hit, waiting ${waitTime}ms before retry ${
              attempt + 2
            }/${maxRetries}`
          );
          await sleep(waitTime);
          continue;
        }
      }

      // If it's the last attempt or not a rate limit error, throw
      if (attempt === maxRetries - 1) {
        throw new Error(
          "Failed to generate chart suggestion after multiple attempts"
        );
      }
    }
  }
};

// Helper function to validate SQL query against schema
export const validateSqlQuery = async (
  query: string,
  connectionUrl: string,
  connectionName?: string
) => {
  "use server";
  try {
    // Try to get schema from cached data first
    let schema;
    if (connectionName) {
      const enhancedSchema = await loadEnhancedSchema(connectionName);
      if (enhancedSchema) {
        schema = enhancedSchema.basicSchema;
        console.log(`Using cached schema for validation: ${connectionName}`);
      }
    }

    // If no cached schema, get from database
    if (!schema) {
      console.log(
        `No cached schema found for validation, fetching from database`
      );
      schema = await getDatabaseSchema(connectionUrl);
    }

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
        !schema.tables.some(
          (table: any) => table.name.toLowerCase() === tableName
        )
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
    schema.tables.forEach((table: any) => {
      if (tableNames.includes(table.name.toLowerCase())) {
        table.columns.forEach((column: any) => {
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
