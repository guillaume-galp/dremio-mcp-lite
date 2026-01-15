#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, } from '@modelcontextprotocol/sdk/types.js';
import dotenv from 'dotenv';
import { DremioClient, isSelectQuery } from './dremio-client.js';
// Load environment variables
dotenv.config();
const DREMIO_URL = process.env.DREMIO_URL;
const DREMIO_PAT = process.env.DREMIO_PAT;
const DREMIO_REJECT_UNAUTHORIZED = process.env.DREMIO_REJECT_UNAUTHORIZED !== 'false';
if (!DREMIO_URL || !DREMIO_PAT) {
    console.error('Error: DREMIO_URL and DREMIO_PAT must be set in .env file');
    process.exit(1);
}
// Initialize Dremio client
const dremioClient = new DremioClient({
    url: DREMIO_URL,
    pat: DREMIO_PAT,
    rejectUnauthorized: DREMIO_REJECT_UNAUTHORIZED,
});
// Define MCP tools
const tools = [
    {
        name: 'catalog_browse',
        description: 'Browse Dremio catalog to list sources, spaces, folders, and tables. Optionally provide a path to browse a specific location.',
        inputSchema: {
            type: 'object',
            properties: {
                path: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Optional path array to browse (e.g., ["source_name", "folder_name"])',
                },
            },
        },
    },
    {
        name: 'schema_get',
        description: 'Get the schema of a specific table in Dremio',
        inputSchema: {
            type: 'object',
            properties: {
                table_path: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Full path to the table as an array (e.g., ["source_name", "schema", "table_name"])',
                },
            },
            required: ['table_path'],
        },
    },
    {
        name: 'sql_query',
        description: 'Execute a SELECT query on Dremio. Returns up to 1000 rows. Read-only queries only.',
        inputSchema: {
            type: 'object',
            properties: {
                sql: {
                    type: 'string',
                    description: 'The SELECT SQL query to execute',
                },
                max_rows: {
                    type: 'number',
                    description: 'Maximum number of rows to return (default: 1000, max: 1000)',
                    default: 1000,
                },
            },
            required: ['sql'],
        },
    },
    {
        name: 'table_preview',
        description: 'Preview the first 10 rows of a table',
        inputSchema: {
            type: 'object',
            properties: {
                table_path: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Full path to the table as an array (e.g., ["source_name", "schema", "table_name"])',
                },
            },
            required: ['table_path'],
        },
    },
    {
        name: 'search_catalog',
        description: 'Search for tables and datasets in the Dremio catalog by name',
        inputSchema: {
            type: 'object',
            properties: {
                search_term: {
                    type: 'string',
                    description: 'Search term to find tables/datasets by name',
                },
            },
            required: ['search_term'],
        },
    },
    {
        name: 'explain_query',
        description: 'Get the execution plan for a SQL query',
        inputSchema: {
            type: 'object',
            properties: {
                sql: {
                    type: 'string',
                    description: 'The SQL query to explain',
                },
            },
            required: ['sql'],
        },
    },
];
// Create MCP server
const server = new Server({
    name: '@guillaume-galp/dremio-mcp-lite',
    version: '1.0.0',
}, {
    capabilities: {
        tools: {},
    },
});
// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools };
});
// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
        switch (name) {
            case 'catalog_browse': {
                const path = args?.path;
                const result = await dremioClient.getCatalog(path);
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(result, null, 2),
                        },
                    ],
                };
            }
            case 'schema_get': {
                const tablePath = args?.table_path;
                if (!tablePath || !Array.isArray(tablePath)) {
                    throw new Error('table_path is required and must be an array');
                }
                const schema = await dremioClient.getTableSchema(tablePath);
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(schema, null, 2),
                        },
                    ],
                };
            }
            case 'sql_query': {
                const sql = args?.sql;
                if (!sql) {
                    throw new Error('sql is required');
                }
                // Validate it's a SELECT query using the robust validation
                if (!isSelectQuery(sql)) {
                    throw new Error('Only SELECT queries are allowed');
                }
                const maxRows = Math.min(args?.max_rows || 1000, 1000);
                const result = await dremioClient.executeQuery(sql, maxRows);
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(result, null, 2),
                        },
                    ],
                };
            }
            case 'table_preview': {
                const tablePath = args?.table_path;
                if (!tablePath || !Array.isArray(tablePath)) {
                    throw new Error('table_path is required and must be an array');
                }
                const result = await dremioClient.previewTable(tablePath);
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(result, null, 2),
                        },
                    ],
                };
            }
            case 'search_catalog': {
                const searchTerm = args?.search_term;
                if (!searchTerm) {
                    throw new Error('search_term is required');
                }
                const results = await dremioClient.searchCatalog(searchTerm);
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(results, null, 2),
                        },
                    ],
                };
            }
            case 'explain_query': {
                const sql = args?.sql;
                if (!sql) {
                    throw new Error('sql is required');
                }
                const result = await dremioClient.explainQuery(sql);
                return {
                    content: [
                        {
                            type: 'text',
                            text: result.text,
                        },
                    ],
                };
            }
            default:
                throw new Error(`Unknown tool: ${name}`);
        }
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
            content: [
                {
                    type: 'text',
                    text: `Error: ${errorMessage}`,
                },
            ],
            isError: true,
        };
    }
});
// Start server
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('Dremio MCP server running on stdio');
}
main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map