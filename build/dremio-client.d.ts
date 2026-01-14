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
/**
 * Validate that SQL is a SELECT query
 * This removes SQL comments and checks if the query starts with SELECT
 */
export declare function isSelectQuery(sql: string): boolean;
export declare class DremioClient {
    private client;
    constructor(config: DremioConfig);
    /**
     * Escape SQL identifier by wrapping in double quotes and escaping any existing quotes
     */
    private escapeIdentifier;
    /**
     * Build a fully qualified table name from path components
     */
    private buildTableReference;
    getCatalog(path?: string[]): Promise<CatalogEntity>;
    getTableSchema(tablePath: string[]): Promise<TableSchema[]>;
    executeQuery(sql: string, maxRows?: number): Promise<QueryResult>;
    previewTable(tablePath: string[]): Promise<QueryResult>;
    searchCatalog(searchTerm: string): Promise<CatalogEntity[]>;
    /**
     * Validate that SQL is a SELECT query
     */
    private isSelectQuery;
    explainQuery(sql: string): Promise<ExplainResult>;
}
//# sourceMappingURL=dremio-client.d.ts.map