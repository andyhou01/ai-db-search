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
) => {
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

      For string fields, use the ILIKE operator with wildcards and convert both the search term and the field to lowercase using LOWER() function for case-insensitive matching. For example: LOWER(column_name) ILIKE LOWER('%search_term%').

      When answering questions about specific entities, ensure you are selecting both the identifying column and the relevant data columns to provide context.

      For text fields that may contain comma-separated values, use string functions like TRIM() when comparing to ensure accurate results.

      If the user asks for temporal trends or data 'over time', group by the appropriate time unit (year, month, day) based on available date/timestamp columns.

      For abbreviations or acronyms in search terms, consider both the abbreviated and full forms in your query when appropriate.

      If the user asks for a rate, return it as a decimal. For example, 0.1 would be 10%.

      EVERY QUERY SHOULD RETURN QUANTITATIVE DATA THAT CAN BE PLOTTED ON A CHART! There should always be at least two columns. If the user asks for a single value, include a relevant grouping dimension or return a count alongside it.`,
      prompt: `Generate the query necessary to retrieve the data the user wants: ${input}`,
      schema: z.object({
        query: z.string(),
      }),
    });
    return result.object.query;
  } catch (e) {
    console.error(e);
    throw new Error("Failed to generate query");
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

  let data: any;
  try {
    const client = getSqlClient(connectionUrl);
    data = await client.query(query);
  } catch (e: any) {
    if (e.message.includes('relation "unicorns" does not exist')) {
      console.log(
        "Table does not exist, creating and seeding it with dummy data now..."
      );
      throw Error("Table does not exist");
    } else {
      throw e;
    }
  }

  return data.rows as Result[];
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
  const system = `You are a data visualization expert. `;

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
