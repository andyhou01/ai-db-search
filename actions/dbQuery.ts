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

      return {
        error: `Column '${columnName}' does not exist in the database schema.`,
        suggestions: {},
        validColumns: [],
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

// Generate AI-powered answer from query results
export const generateAnswerFromResults = async (
  userQuestion: string,
  results: Result[],
  maxRetries: number = 3
) => {
  "use server";

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const { object: answer } = await generateObject({
        model: openai("gpt-4o"),
        system: `You are a data analyst expert. Your job is to analyze query results and provide clear, concise answers to business questions.

        Guidelines for your responses:
        1. Start with the direct answer to the user's question
        2. Provide specific numbers, percentages, and trends when available
        3. Highlight key insights and patterns in the data
        4. Identify potential reasons for changes or anomalies if apparent from the data
        5. Keep the response conversational and business-focused
        6. If the data shows concerning trends, mention them
        7. Suggest potential next steps or areas to investigate if relevant

        Response format:
        - Start with a clear answer sentence
        - Follow with 2-3 bullet points of key insights
        - End with a brief summary or recommendation if applicable`,
        prompt: `Based on the following data, answer this question: "${userQuestion}"

        Data Results:
        ${JSON.stringify(results, null, 2)}

        Data Summary:
        - Total records: ${results.length}
        - Columns: ${Object.keys(results[0] || {}).join(", ")}
        
        Please provide a clear, business-focused answer that directly addresses the user's question.`,
        schema: z.object({
          answer: z.string().describe("The main answer to the user's question"),
          keyInsights: z
            .array(z.string())
            .describe("2-3 key insights from the data"),
          summary: z.string().describe("Brief summary or recommendation"),
        }),
      });

      return {
        answer: answer.answer,
        keyInsights: answer.keyInsights,
        summary: answer.summary,
      };
    } catch (e: any) {
      console.error(
        `Answer generation attempt ${attempt + 1} failed:`,
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
        throw new Error("Failed to generate answer after multiple attempts");
      }
    }
  }
};

// Generate chart configuration from query results
export const generateChartConfig = async (
  results: Result[],
  userQuestion: string,
  maxRetries: number = 3
) => {
  "use server";

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const { object: config } = await generateObject({
        model: openai("gpt-4o"),
        system: `You are a data visualization expert. Your job is to analyze query results and create optimal chart configurations.

        Guidelines for chart selection:
        1. Bar charts: Good for comparing categories, showing rankings, or discrete values
        2. Line charts: Best for time series data, trends over time, or continuous data
        3. Area charts: Similar to line charts but better for showing cumulative data or parts of a whole over time
        4. Pie charts: Use sparingly, only for showing parts of a whole with few categories (3-5 max)

        Chart configuration rules:
        - Always choose the most appropriate chart type for the data
        - For time series data, use line or area charts
        - For categorical comparisons, use bar charts
        - Set appropriate colors that are accessible and meaningful
        - Create clear, descriptive titles
        - Provide insightful takeaways about what the chart reveals

        When analyzing the data:
        - Look at the column types and names to understand the data structure
        - Identify time/date columns for x-axis in time series
        - Identify categorical columns for grouping
        - Identify numeric columns for measurements
        - Consider the business context from the user question`,
        prompt: `Based on the following query results, create an optimal chart configuration.

        User Question: "${userQuestion}"
        
        Data Sample (first 5 rows):
        ${JSON.stringify(results.slice(0, 5), null, 2)}
        
        Data Summary:
        - Total records: ${results.length}
        - Columns: ${Object.keys(results[0] || {}).join(", ")}
        
        Create a chart configuration that best visualizes this data and answers the user's question.`,
        schema: configSchema,
      });

      return { config };
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
          "Failed to generate chart config after multiple attempts"
        );
      }
    }
  }
};
