import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import https from 'https';

export interface DremioConfig {
  url: string;
  pat: string;
  rejectUnauthorized?: boolean;
}

export interface CatalogEntity {
  id: string;
  path: string[];
  tag: string;
  type: string;
  containerType?: string;
  children?: CatalogEntity[];
}

export interface TableSchema {
  name: string;
  type: string;
}

export interface QueryResult {
  rowCount: number;
  schema: TableSchema[];
  rows: any[];
}

export interface ExplainResult {
  text: string;
}

/**
 * Validate that SQL is a SELECT query
 * This removes SQL comments and checks if the query starts with SELECT
 */
export function isSelectQuery(sql: string): boolean {
  // Remove leading whitespace and SQL comments
  let cleaned = sql.trim();

  // Remove single-line comments (-- comment)
  cleaned = cleaned.replace(/--[^\n]*\n/g, '\n');

  // Remove multi-line comments (/* comment */)
  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');

  // Trim again after removing comments
  cleaned = cleaned.trim();

  // Check if it starts with SELECT (case-insensitive)
  return /^SELECT\s/i.test(cleaned);
}

export class DremioClient {
  private client: AxiosInstance;

  constructor(config: DremioConfig) {
    const axiosConfig: AxiosRequestConfig = {
      baseURL: config.url,
      headers: {
        'Authorization': `Bearer ${config.pat}`,
        'Content-Type': 'application/json',
      },
    };

    // Configure SSL certificate verification
    if (config.rejectUnauthorized === false) {
      axiosConfig.httpsAgent = new https.Agent({
        rejectUnauthorized: false,
      });
    }

    this.client = axios.create(axiosConfig);
  }

  /**
   * Escape SQL identifier by wrapping in double quotes and escaping any existing quotes
   */
  private escapeIdentifier(identifier: string): string {
    // Replace any double quotes with escaped double quotes
    const escaped = identifier.replace(/"/g, '""');
    return `"${escaped}"`;
  }

  /**
   * Build a fully qualified table name from path components
   */
  private buildTableReference(tablePath: string[]): string {
    if (!tablePath || tablePath.length === 0) {
      throw new Error('Table path cannot be empty');
    }
    // Validate each component
    for (const component of tablePath) {
      if (!component || typeof component !== 'string') {
        throw new Error('Invalid table path component');
      }
    }
    return tablePath.map(part => this.escapeIdentifier(part)).join('.');
  }

  async getCatalog(path?: string[]): Promise<CatalogEntity> {
    let url = '/api/v3/catalog';
    if (path && path.length > 0) {
      // Encode each path component separately and join with /
      const encodedPath = path.map(p => encodeURIComponent(p)).join('/');
      url = `/api/v3/catalog/${encodedPath}`;
    }
    const response = await this.client.get(url);
    return response.data;
  }

  async getTableSchema(tablePath: string[]): Promise<TableSchema[]> {
    const tableRef = this.buildTableReference(tablePath);
    const query = `SELECT * FROM ${tableRef} LIMIT 0`;
    const result = await this.executeQuery(query);
    return result.schema;
  }

  async executeQuery(sql: string, maxRows: number = 500): Promise<QueryResult> {
    try {
      // Dremio API has a maximum limit of 500 rows
      const limitedMaxRows = Math.min(maxRows, 500);
      const requestBody = {
        sql: sql
      };
      const response = await this.client.post('/api/v3/sql', requestBody);

      const jobId = response.data.id;

      // Poll for job completion
      let jobState = 'RUNNING';
      let attempts = 0;
      const maxAttempts = 30;

      while (jobState === 'RUNNING' || jobState === 'STARTING' || jobState === 'ENQUEUED') {
        if (attempts >= maxAttempts) {
          throw new Error('Query timeout');
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
        const jobResponse = await this.client.get(`/api/v3/job/${jobId}`);
        jobState = jobResponse.data.jobState;

        // If job failed, get error details
        if (jobState === 'FAILED' || jobState === 'CANCELED') {
          const errorMessage = jobResponse.data.errorMessage || 'Unknown error';
          const queryError = jobResponse.data.queryError || '';
          throw new Error(`Query failed with state: ${jobState}. Error: ${errorMessage}${queryError ? '. Details: ' + queryError : ''}`);
        }

        attempts++;
      }

      if (jobState !== 'COMPLETED') {
        throw new Error(`Query failed with state: ${jobState}`);
      }

      // Get results
      const resultsResponse = await this.client.get(`/api/v3/job/${jobId}/results`, {
        params: { limit: limitedMaxRows },
      });

      const schema: TableSchema[] = resultsResponse.data.schema?.map((field: any) => ({
        name: field.name,
        type: field.type,
      })) || [];

      return {
        rowCount: resultsResponse.data.rowCount || 0,
        schema: schema,
        rows: resultsResponse.data.rows || [],
      };
    } catch (error: any) {
      if (error.response) {
        // Include response data for debugging
        throw new Error(`Query failed: ${error.message}. Status: ${error.response.status}. Data: ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  async previewTable(tablePath: string[]): Promise<QueryResult> {
    const tableRef = this.buildTableReference(tablePath);
    const query = `SELECT * FROM ${tableRef} LIMIT 10`;
    return this.executeQuery(query, 10);
  }

  async searchCatalog(searchTerm: string): Promise<CatalogEntity[]> {
    // Search through catalog recursively
    const rootCatalog = await this.getCatalog();
    const results: CatalogEntity[] = [];

    const searchRecursive = (entity: CatalogEntity) => {
      // Handle entities with path array
      if (entity.path && Array.isArray(entity.path) && entity.path.length > 0) {
        const name = entity.path[entity.path.length - 1] || '';
        if (name.toLowerCase().includes(searchTerm.toLowerCase())) {
          results.push(entity);
        }
      }

      if (entity.children && Array.isArray(entity.children)) {
        for (const child of entity.children) {
          searchRecursive(child);
        }
      }
    };

    // Handle root catalog response format
    const catalogData = (rootCatalog as any).data || [rootCatalog];
    if (Array.isArray(catalogData)) {
      for (const entity of catalogData) {
        searchRecursive(entity);
      }
    } else {
      searchRecursive(catalogData);
    }

    return results;
  }

  /**
   * Validate that SQL is a SELECT query
   */
  private isSelectQuery(sql: string): boolean {
    return isSelectQuery(sql);
  }

  async explainQuery(sql: string): Promise<ExplainResult> {
    // Validate that the query is a SELECT statement before explaining
    if (!this.isSelectQuery(sql)) {
      throw new Error('Only SELECT queries can be explained');
    }

    const explainSql = `EXPLAIN PLAN FOR ${sql}`;
    const result = await this.executeQuery(explainSql);

    // Combine all rows into a single text output
    const text = result.rows.map(row => Object.values(row).join(' ')).join('\n');

    return { text };
  }
}
