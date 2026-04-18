export interface PaginationParams {
    page: number;
    limit: number;
}
export interface PaginatedResult<T> {
    data: T[];
    meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
}
export declare function getPaginationParams(query: Record<string, unknown>): PaginationParams;
export declare function buildPaginatedResult<T>(data: T[], total: number, { page, limit }: PaginationParams): PaginatedResult<T>;
//# sourceMappingURL=pagination.d.ts.map