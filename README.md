# dremio-mcp-lite

A TypeScript MCP (Model Context Protocol) server for Dremio data exploration. This tool enables AI assistants to interact with Dremio through a set of read-only operations.

## Features

- **Fast Startup**: Optimized for <1s startup time for VS Code stdio MCP
- **Read-Only Operations**: Safe exploration of your Dremio data catalog
- **6 Core Tools**:
  - `catalog_browse`: List sources, spaces, folders, and tables
  - `schema_get`: Get table schemas
  - `sql_query`: Execute SELECT queries (max 1000 rows)
  - `table_preview`: Preview first 10 rows of a table
  - `search_catalog`: Find tables by name
  - `explain_query`: Get query execution plans

## Installation

```bash
npm install @guillaume-galp/dremio-mcp-lite
```

## Configuration

Create a `.env` file in your project root:

```bash
DREMIO_URL=http://localhost:9047
DREMIO_PAT=your_personal_access_token_here
```

Or copy from the example:

```bash
cp .env.example .env
```

### Getting a Dremio Personal Access Token

1. Log in to your Dremio instance
2. Go to Settings → Personal Access Tokens
3. Click "Create Token"
4. Copy the token and add it to your `.env` file

## Usage

### As an MCP Server

Add to your MCP client configuration (e.g., VS Code `mcp.json`):

```json
{
  "mcpServers": {
    "dremio": {
      "type": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@guillaume-galp/dremio-mcp-lite"
      ],
      "envFile": "${userHome}/.dremio-mcp.env",
      "gallery": true
    }
  }
}
```

**Configuration Notes:**
- `type`: Must be `"stdio"` for standard input/output communication
- `-y`: Auto-confirms npx package installation
- `envFile`: Path to your environment file containing `DREMIO_URL` and `DREMIO_PAT`
  - Windows example: `"C:\\Users\\YourUsername\\AppData\\Roaming\\Code\\User\\mcp.env"`
  - macOS/Linux example: `"${userHome}/.dremio-mcp.env"` or `"/home/username/.dremio-mcp.env"`
- `gallery`: Optional, set to `true` to show in MCP gallery

Or if installed globally:

```json
{
  "mcpServers": {
    "dremio": {
      "type": "stdio",
      "command": "dremio-mcp-lite",
      "envFile": "${userHome}/.dremio-mcp.env",
      "gallery": true
    }
  }
}
```

### Available Tools

#### catalog_browse
Browse the Dremio catalog structure.

```typescript
// List all sources
catalog_browse()

// Browse a specific path
catalog_browse({ path: ["source_name", "folder"] })
```

#### schema_get
Get the schema definition of a table.

```typescript
schema_get({ table_path: ["source", "schema", "table"] })
```

#### sql_query
Execute SELECT queries (read-only).

```typescript
sql_query({ 
  sql: "SELECT * FROM source.schema.table WHERE id > 100",
  max_rows: 500  // Optional, default 1000
})
```

#### table_preview
Quick preview of table data (first 10 rows).

```typescript
table_preview({ table_path: ["source", "schema", "table"] })
```

#### search_catalog
Search for tables and datasets by name.

```typescript
search_catalog({ search_term: "customer" })
```

#### explain_query
Get the execution plan for a query.

```typescript
explain_query({ sql: "SELECT * FROM source.schema.table" })
```

## Security

This MCP server implements several security measures:

- **Read-Only Operations**: Only SELECT queries are allowed. All modifications (INSERT, UPDATE, DELETE, etc.) are blocked.
- **SQL Injection Protection**: Table paths are properly escaped using SQL identifier quoting to prevent injection attacks.
- **Query Validation**: SQL queries are validated to ensure they are SELECT statements, even when prefixed with comments or whitespace.
- **Personal Access Tokens**: Uses Dremio PAT authentication stored securely in .env file (never commit .env to version control).

## Development

### Build

```bash
npm run build
```

### Run Locally

```bash
npm start
```

### Publishing to npm

The package is automatically published to npm when a version tag is pushed:

1. Update the version in `package.json`:
   ```bash
   npm version patch  # or minor, or major
   ```

2. Push the tag to GitHub:
   ```bash
   git push origin main --tags
   ```

3. The GitHub Actions workflow will automatically build and publish to npm

**Prerequisites:**
- `NPM_ACCESS_TOKEN` must be configured in GitHub repository secrets
- The token must have publish access to the `@guillaume-galp` scope on npmjs.org

## Requirements

- Node.js >= 18
- Access to a Dremio instance (default port: 9047)
- Valid Dremio Personal Access Token

## License

MIT
