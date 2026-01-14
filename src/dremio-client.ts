import axios, { AxiosInstance } from 'axios';

export interface DremioConfig {
  url: string;
  pat: string;
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

export class DremioClient {
  private client: AxiosInstance;

  constructor(config: DremioConfig) {
    this.client = axios.create({
      baseURL: config.url,
      headers: {
        'Authorization': `Bearer ${config.pat}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async getCatalog(path?: string[]): Promise<CatalogEntity> {
    const pathStr = path ? path.join('/') : '';
    const url = pathStr ? `/api/v3/catalog/${encodeURIComponent(pathStr)}` : '/api/v3/catalog';
    const response = await this.client.get(url);
    return response.data;
  }

  async getTableSchema(tablePath: string[]): Promise<TableSchema[]> {
    const pathStr = tablePath.join('.');
    const query = `SELECT * FROM ${pathStr} LIMIT 0`;
    const result = await this.executeQuery(query);
    return result.schema;
  }

  async executeQuery(sql: string, maxRows: number = 1000): Promise<QueryResult> {
    const response = await this.client.post('/api/v3/sql', {
      sql: sql,
    });

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
      attempts++;
    }

    if (jobState !== 'COMPLETED') {
      throw new Error(`Query failed with state: ${jobState}`);
    }

    // Get results
    const resultsResponse = await this.client.get(`/api/v3/job/${jobId}/results`, {
      params: { limit: maxRows },
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
  }

  async previewTable(tablePath: string[]): Promise<QueryResult> {
    const pathStr = tablePath.join('.');
    const query = `SELECT * FROM ${pathStr} LIMIT 10`;
    return this.executeQuery(query, 10);
  }

  async searchCatalog(searchTerm: string): Promise<CatalogEntity[]> {
    // Search through catalog recursively
    const rootCatalog = await this.getCatalog();
    const results: CatalogEntity[] = [];

    const searchRecursive = async (entity: CatalogEntity) => {
      const name = entity.path[entity.path.length - 1] || '';
      if (name.toLowerCase().includes(searchTerm.toLowerCase())) {
        results.push(entity);
      }

      if (entity.children) {
        for (const child of entity.children) {
          await searchRecursive(child);
        }
      }
    };

    await searchRecursive(rootCatalog);
    return results;
  }

  async explainQuery(sql: string): Promise<ExplainResult> {
    const explainSql = `EXPLAIN PLAN FOR ${sql}`;
    const result = await this.executeQuery(explainSql);
    
    // Combine all rows into a single text output
    const text = result.rows.map(row => Object.values(row).join(' ')).join('\n');
    
    return { text };
  }
}
