# Copilot Instructions for dremio-mcp-lite

## Project Overview

This is a TypeScript MCP (Model Context Protocol) server for Dremio data exploration. The project provides read-only operations for AI assistants to interact with Dremio databases.

**Key characteristics:**
- TypeScript with ES modules
- MCP server using `@modelcontextprotocol/sdk`
- Read-only SQL operations for security
- Optimized for fast startup (<1s)
- No testing infrastructure currently exists

## Project Structure

```
/src
  ├── index.ts           # Main MCP server setup and tool handlers
  └── dremio-client.ts   # Dremio API client and SQL utilities
```

## Build and Development Commands

- **Build:** `npm run build` - Compiles TypeScript to `/build` directory
- **Run locally:** `npm start` - Runs the built server
- **Prepare:** `npm run prepare` - Auto-runs build (triggered by npm)

**Important:** Always run `npm run build` after code changes before testing.

## Security Practices

This project has strict security requirements:

1. **Read-Only SQL Queries:** Only SELECT statements are allowed
   - The `isSelectQuery()` function validates SQL queries
   - Removes SQL comments before validation to prevent bypass attempts
   - All modifications (INSERT, UPDATE, DELETE, DROP, etc.) must be blocked

2. **SQL Injection Protection:**
   - Use `escapeIdentifier()` method for table/column identifiers
   - Wraps identifiers in double quotes and escapes existing quotes
   - Never concatenate user input directly into SQL queries

3. **Credential Management:**
   - Dremio PAT (Personal Access Token) stored in `.env` file
   - Never commit `.env` file to version control
   - Always use `.env.example` as template

4. **Query Validation:**
   - Validate queries handle comments (`--` and `/* */`)
   - Validate queries handle leading/trailing whitespace
   - Ensure `isSelectQuery()` cannot be bypassed

## Code Style and Conventions

- **TypeScript:** Use strict typing, avoid `any` where possible
- **ES Modules:** Use `.js` extensions in imports (e.g., `'./dremio-client.js'`)
- **Error Handling:** Return structured error responses with `isError: true`
- **Async/Await:** Prefer async/await over promises
- **Comments:** Minimal comments, use JSDoc for public APIs
- **No Testing:** Do not add testing infrastructure unless explicitly requested

## TypeScript Configuration

- Target: ES2022
- Module: Node16
- Module Resolution: Node16
- Strict mode enabled
- Output directory: `./build`

## MCP Server Architecture

The server implements six core tools:

1. **catalog_browse** - Browse Dremio catalog structure
2. **schema_get** - Get table schema (uses `LIMIT 0` query)
3. **sql_query** - Execute SELECT queries (max 1000 rows)
4. **table_preview** - Preview first 10 rows
5. **search_catalog** - Search for tables by name
6. **explain_query** - Get query execution plans

**Tool Implementation Pattern:**
- Each tool in `index.ts` switch statement
- Validate inputs (required parameters, types)
- Call corresponding `DremioClient` method
- Return JSON-formatted text content
- Catch and return errors with `isError: true`

## Dremio Client Design

The `DremioClient` class handles all Dremio API interactions:

- **Authentication:** Bearer token in headers
- **API Version:** Uses Dremio v3 REST API (`/api/v3/`)
- **Query Execution:** Asynchronous job polling pattern
  - Submit query → Get job ID → Poll job status → Fetch results
  - Max 30 attempts with 1s intervals
  - Handles states: STARTING, ENQUEUED, RUNNING, COMPLETED, FAILED

## Important Implementation Details

1. **Table Path Handling:**
   - Table paths are arrays: `["source", "schema", "table"]`
   - Use `buildTableReference()` to convert to SQL identifier
   - Each component is escaped with `escapeIdentifier()`

2. **Query Result Structure:**
   ```typescript
   {
     rowCount: number,
     schema: TableSchema[],
     rows: any[]
   }
   ```

3. **Schema Retrieval:**
   - Uses `SELECT * FROM table LIMIT 0` pattern
   - Extracts schema from query metadata
   - No actual rows returned

4. **Catalog Browsing:**
   - Root catalog: `/api/v3/catalog`
   - Nested paths: `/api/v3/catalog/{encoded-path}`
   - Returns hierarchical structure with children

## Dependencies

- `@modelcontextprotocol/sdk` - MCP protocol implementation
- `axios` - HTTP client for Dremio API
- `dotenv` - Environment variable management

## When Making Changes

1. **Security First:** Never compromise read-only guarantees
2. **Minimal Changes:** Keep the codebase lean and focused
3. **No Breaking Changes:** Maintain backward compatibility
4. **ES Module Imports:** Always use `.js` extensions
5. **Build Before Test:** Run `npm run build` after code changes
6. **Error Messages:** Provide clear, actionable error messages
