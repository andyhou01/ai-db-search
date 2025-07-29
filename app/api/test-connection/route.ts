import { NextResponse } from "next/server";
import { Client } from "pg";

export async function POST(request: Request) {
  let client: Client | null = null;

  try {
    const body = await request.json();

    // Use the URL directly
    const connectionString = body.url;

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

    return NextResponse.json({
      success: true,
      message: "Connection successful",
      testResult: result.rows[0],
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
