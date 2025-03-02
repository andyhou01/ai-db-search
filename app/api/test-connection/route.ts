import { NextResponse } from "next/server";
import { createPool } from "@vercel/postgres";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Use the URL directly
    const connectionString = body.url;

    // Test connection
    const client = createPool({
      connectionString: connectionString,
    });

    await client.query("SELECT 1");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Connection test failed:", error);
    return NextResponse.json(
      { error: "Failed to connect to database" },
      { status: 500 }
    );
  }
}
