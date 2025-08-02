import { NextResponse } from "next/server";
import { Client } from "pg";
import { getEnhancedDatabaseSchema } from "@/actions/dbQuery";

export async function POST(request: Request) {
  let client: Client | null = null;

  try {
    const body = await request.json();

    // Use the URL directly
    const connectionString = body.url;
    const connectionName = body.name || "unnamed_connection";

    if (!connectionString) {
      return NextResponse.json(
        { error: "Connection string is required" },
        { status: 400 }
      );
    }

    console.log(
      "Testing connection to:",
      connectionString.replace(/:[^:@]*@/, ":****@")
    );

    // For Azure PostgreSQL, use the native pg Client with proper SSL configuration
    client = new Client({
      connectionString: connectionString,
      ssl: connectionString.includes(".postgres.database.azure.com")
        ? { rejectUnauthorized: false }
        : undefined,
      connectionTimeoutMillis: 8000, // 8 second connection timeout
      query_timeout: 5000, // 5 second query timeout
    });

    // Connect to the database
    console.log("Attempting to connect...");
    await client.connect();
    console.log("Connected successfully");

    // Test with a simple query
    console.log("Running test query...");
    const result = await client.query("SELECT 1 as test");
    console.log("Query result:", result.rows);

    // Close the test connection before starting schema analysis
    await client.end();
    client = null;

    // Get enhanced database schema with table summaries
    console.log("Analyzing database schema and collecting table summaries...");
    const enhancedSchema = await getEnhancedDatabaseSchema(
      connectionString,
      connectionName
    );

    if (!enhancedSchema) {
      return NextResponse.json(
        { error: "Failed to analyze database schema" },
        { status: 500 }
      );
    }

    console.log(
      `Enhanced schema analysis complete. Found ${enhancedSchema.tableSummaries.length} tables.`
    );

    return NextResponse.json({
      success: true,
      message: "Connection successful and database analyzed",
      testResult: result.rows[0],
      schema: enhancedSchema.basicSchema,
      enhancedSchema: {
        tableCount: enhancedSchema.tableSummaries.length,
        totalRows: enhancedSchema.tableSummaries.reduce(
          (sum, table) => sum + table.rowCount,
          0
        ),
        lastUpdated: enhancedSchema.lastUpdated,
      },
    });
  } catch (error) {
    console.error("Connection test failed:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    // Provide more specific error messages
    let userFriendlyMessage = `Failed to connect to database: ${errorMessage}`;

    if (errorMessage.includes("timeout")) {
      userFriendlyMessage =
        "Connection timeout - please check your network connection and database availability";
    } else if (errorMessage.includes("authentication")) {
      userFriendlyMessage =
        "Authentication failed - please check your username and password";
    } else if (errorMessage.includes("does not exist")) {
      userFriendlyMessage =
        "Database does not exist - please check the database name";
    } else if (errorMessage.includes("ENOTFOUND")) {
      userFriendlyMessage = "Server not found - please check the hostname";
    }

    return NextResponse.json({ error: userFriendlyMessage }, { status: 500 });
  } finally {
    // Clean up client connection if it exists
    if (client) {
      try {
        console.log("Closing connection...");
        await client.end();
      } catch (e) {
        console.warn("Error closing client connection:", e);
      }
    }
  }
}
