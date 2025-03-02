export interface ConnectionConfig {
  name: string;
  type: string;
  host: string;
  port: string;
  username: string;
  password: string;
  database: string;
  url?: string;
  schema?: string;
}
