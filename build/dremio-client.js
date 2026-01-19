import axios from 'axios';
import https from 'https';
/**
 * Validate that SQL is a SELECT query
 * This removes SQL comments and checks if the query starts with SELECT
 */
export function isSelectQuery(sql) {
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
    client;
    constructor(config) {
        const axiosConfig = {
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
    escapeIdentifier(identifier) {
        // Replace any double quotes with escaped double quotes
        const escaped = identifier.replace(/"/g, '""');
        return `"${escaped}"`;
    }
    /**
     * Build a fully qualified table name from path components
     */
    buildTableReference(tablePath) {
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
    async getCatalog(path) {
        let url = '/api/v3/catalog';
        if (path && path.length > 0) {
            // Encode each path component separately and join with /
            const encodedPath = path.map(p => encodeURIComponent(p)).join('/');
            url = `/api/v3/catalog/${encodedPath}`;
        }
        const response = await this.client.get(url);
        return response.data;
    }
    async getTableSchema(tablePath) {
        const tableRef = this.buildTableReference(tablePath);
        const query = `SELECT * FROM ${tableRef} LIMIT 0`;
        const result = await this.executeQuery(query);
        return result.schema;
    }
    async executeQuery(sql, maxRows = 500) {
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
            const schema = resultsResponse.data.schema?.map((field) => ({
                name: field.name,
                type: field.type,
            })) || [];
            return {
                rowCount: resultsResponse.data.rowCount || 0,
                schema: schema,
                rows: resultsResponse.data.rows || [],
            };
        }
        catch (error) {
            if (error.response) {
                // Include response data for debugging
                throw new Error(`Query failed: ${error.message}. Status: ${error.response.status}. Data: ${JSON.stringify(error.response.data)}`);
            }
            throw error;
        }
    }
    async previewTable(tablePath) {
        const tableRef = this.buildTableReference(tablePath);
        const query = `SELECT * FROM ${tableRef} LIMIT 10`;
        return this.executeQuery(query, 10);
    }
    async searchCatalog(searchTerm) {
        // Search through catalog recursively
        const rootCatalog = await this.getCatalog();
        const results = [];
        const searchRecursive = (entity) => {
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
        const catalogData = rootCatalog.data || [rootCatalog];
        if (Array.isArray(catalogData)) {
            for (const entity of catalogData) {
                searchRecursive(entity);
            }
        }
        else {
            searchRecursive(catalogData);
        }
        return results;
    }
    /**
     * Validate that SQL is a SELECT query
     */
    isSelectQuery(sql) {
        return isSelectQuery(sql);
    }
    async explainQuery(sql) {
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
//# sourceMappingURL=dremio-client.js.map