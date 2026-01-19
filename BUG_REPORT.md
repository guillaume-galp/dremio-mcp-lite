# Dremio MCP Tools - Bug Report & Testing

## Bugs Identified and Fixed

### 1. **search_catalog - TypeError on undefined path** ✅ FIXED
**Location:** `src/dremio-client.ts:173`

**Problem:**
```typescript
const name = entity.path[entity.path.length - 1] || '';
```
This failed with "Cannot read properties of undefined (reading 'length')" because:
- Root catalog response has `data` array, not a `path` property
- The code didn't handle the root catalog response structure

**Fix Applied:**
- Added proper handling for root catalog response format
- Added null/undefined checks for `path` and `children` arrays
- Properly iterate through `data` array if present
- Made `searchRecursive` synchronous (no need for async)

### 2. **catalog_browse - 404 errors on specific paths** ✅ FIXED
**Location:** `src/dremio-client.ts:102`

**Problem:**
```typescript
const url = pathStr ? `/api/v3/catalog/${encodeURIComponent(pathStr)}` : '/api/v3/catalog';
```
This encoded the entire path string as one unit instead of encoding each component separately.

Example:
- Input: `["ulysses1", "arpu"]`
- Wrong: `/api/v3/catalog/ulysses1%2Farpu` (encoded the slash)
- Right: `/api/v3/catalog/ulysses1/arpu` (each component encoded separately)

**Fix Applied:**
- Encode each path component separately
- Join components with `/` after encoding

## Tool Testing Status

### ✅ **catalog_browse** (root level)
**Status:** WORKING
**Tested:** Root catalog retrieval
**Result:** Successfully returns 200+ spaces and sources
**Example:**
```json
{
  "data": [
    { "id": "...", "path": ["commercial-bo-space"], "type": "CONTAINER" },
    ...
  ]
}
```

### ⚠️ **catalog_browse** (with path)
**Status:** FIXED - NEEDS TESTING
**Previous Error:** 404 on paths like `["ulysses1"]`, `["commercial-bo-space"]`
**Fix:** Path encoding corrected
**Needs Testing:**
- `["ulysses1"]`
- `["ulysses1", "arpu"]`
- `["ulysses1", "arpu", "aug_electric_vehicle_transaction"]`

### ⚠️ **search_catalog**
**Status:** FIXED - NEEDS TESTING
**Previous Error:** `Cannot read properties of undefined (reading 'length')`
**Fix:** Proper handling of root catalog structure and null checks
**Needs Testing:**
- Search term: "customer"
- Search term: "electric"
- Search term: "ulysses"

### ❓ **schema_get**
**Status:** UNKNOWN - NEEDS TESTING
**Dependencies:** Uses `executeQuery` with `LIMIT 0`
**Test Path:** `["ulysses1", "arpu", "aug_electric_vehicle_transaction"]`
**Expected:** Returns table schema without data

### ❓ **sql_query**
**Status:** UNKNOWN - NEEDS TESTING
**Security:** Has SELECT-only validation ✅
**Test Query:**
```sql
SELECT * FROM ulysses1.arpu.aug_electric_vehicle_transaction LIMIT 5
```

### ❓ **table_preview**
**Status:** UNKNOWN - NEEDS TESTING
**Dependencies:** Uses `executeQuery` with `LIMIT 10`
**Test Path:** `["ulysses1", "arpu", "aug_electric_vehicle_transaction"]`

### ❓ **explain_query**
**Status:** UNKNOWN - NEEDS TESTING
**Security:** Has SELECT-only validation ✅
**Test Query:**
```sql
SELECT * FROM ulysses1.arpu.aug_electric_vehicle_transaction WHERE timestamp > '2025-01-01'
```

## Security Validation Status

### ✅ SQL Injection Protection
- `escapeIdentifier()` properly escapes table/column identifiers
- Wraps in double quotes and escapes existing quotes

### ✅ Read-Only Enforcement
- `isSelectQuery()` validates SELECT-only queries
- Removes SQL comments (`--` and `/* */`)
- Case-insensitive validation
- Applied to both `sql_query` and `explain_query` tools

### ✅ SSL/TLS Configuration
- Supports `DREMIO_REJECT_UNAUTHORIZED=false` for corporate CAs
- Properly configured HTTPS agent

## Test Plan

### Priority 1: Core Functionality
1. ✅ Root catalog browse - WORKING
2. 🔄 Path-based catalog browse - FIXED, needs testing
3. 🔄 Catalog search - FIXED, needs testing

### Priority 2: Data Access
4. Schema retrieval for known table
5. Preview first 10 rows
6. Execute simple SELECT query

### Priority 3: Advanced Features
7. Query explanation
8. Complex queries with JOINs
9. Queries with WHERE clauses

## Known Limitations

1. **No recursive catalog loading:** `getCatalog(path)` doesn't fetch children automatically
2. **Search is client-side:** Searches through catalog in memory (could be slow for large catalogs)
3. **No pagination:** Query results limited to 1000 rows max
4. **Job timeout:** 30 seconds max query execution time
5. **No query cancellation:** Once started, queries run to completion

## Recommended Improvements

1. **Add catalog caching:** Cache catalog structure to speed up searches
2. **Server-side search:** Use Dremio's search API if available
3. **Streaming results:** Support larger result sets with pagination
4. **Query optimization hints:** Suggest indexes or query rewrites
5. **Connection pooling:** Reuse HTTP connections for better performance

## Test Commands

```bash
# Build the project
npm run build

# Test specific table path
# Path: ulysses1.arpu.aug_electric_vehicle_transaction
# Component 1: ulysses1 (source)
# Component 2: arpu (schema/folder)
# Component 3: aug_electric_vehicle_transaction (table)
```
