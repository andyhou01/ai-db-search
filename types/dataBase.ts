export interface ConnectionConfig {
  name: string;
  type: string;
  host: string;
  port: string;
  username: string;
  password: string;
  database: string;
  url?: string;
  schema?: DatabaseSchema;
  schemaString?: string;
  businessLogic?: string; // Business context and logic description
}

export interface ColumnSummary {
  name: string;
  type: string;
  nullable: boolean;
  default: string;
  // Summary statistics for different column types
  summary?: {
    // For categorical/text columns
    distinctValues?: string[];
    topValues?: { value: string; count: number }[];
    // For numerical columns
    min?: number | null;
    max?: number | null;
    mean?: number | null;
    median?: number | null;
    stdDev?: number | null;
    nullCount?: number;
    totalCount?: number;
  };
}

export interface TableSummary {
  name: string;
  rowCount: number;
  columns: ColumnSummary[];
}

export interface DatabaseSchema {
  tables: {
    name: string;
    columns: {
      name: string;
      type: string;
      nullable: boolean;
      default: string;
    }[];
  }[];
}

export interface EnhancedDatabaseSchema {
  basicSchema: DatabaseSchema;
  tableSummaries: TableSummary[];
  connectionName: string;
  lastUpdated: string;
}
