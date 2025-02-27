import { NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { Client } from "pg";
import { MongoClient } from "mongodb";
import { ConnectionConfig } from "@/types/dataBase";

async function testMySQLConnection(config: string | object) {
  const conn = await mysql.createConnection(config as string);
  await conn.connect();
  await conn.end();
}

async function testPostgreSQLConnection(config: string | object) {
  const client = new Client(config as string);
  await client.connect();
  await client.end();
}

async function testMongoDBConnection(config: string | object) {
  const client = new MongoClient(
    typeof config === "string"
      ? config
      : `mongodb://${(config as any).username}:${(config as any).password}@${
          (config as any).host
        }:${(config as any).port}/${(config as any).database}`
  );
  await client.connect();
  await client.close();
}

export async function POST(request: Request) {
  try {
    const connection: ConnectionConfig = await request.json();

    let connectionConfig;
    if (connection.url) {
      connectionConfig = connection.url;
    } else {
      switch (connection.type) {
        case "mysql":
          connectionConfig = {
            host: connection.host,
            port: parseInt(connection.port),
            user: connection.username,
            password: connection.password,
            database: connection.database,
          };
          break;
        case "postgresql":
          connectionConfig = {
            host: connection.host,
            port: parseInt(connection.port),
            user: connection.username,
            password: connection.password,
            database: connection.database,
          };
          break;
        case "mongodb":
          connectionConfig = {
            host: connection.host,
            port: parseInt(connection.port),
            user: connection.username,
            password: connection.password,
            database: connection.database,
          };
          break;
        default:
          throw new Error("Unsupported database type");
      }
    }

    // Test connection based on database type
    switch (connection.type) {
      case "mysql":
        await testMySQLConnection(connectionConfig);
        break;
      case "postgresql":
        await testPostgreSQLConnection(connectionConfig);
        break;
      case "mongodb":
        await testMongoDBConnection(connectionConfig);
        break;
      default:
        throw new Error("Unsupported database type");
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Database connection test failed:", error);
    return NextResponse.json(
      { error: "Failed to connect to database" },
      { status: 500 }
    );
  }
}
