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
