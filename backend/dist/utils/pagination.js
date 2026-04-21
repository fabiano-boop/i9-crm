"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPaginationParams = getPaginationParams;
exports.buildPaginatedResult = buildPaginatedResult;
function getPaginationParams(query) {
    const page = Math.max(1, Number(query['page']) || 1);
    const limit = Math.min(100, Math.max(1, Number(query['limit']) || 20));
    return { page, limit };
}
function buildPaginatedResult(data, total, { page, limit }) {
    const totalPages = Math.ceil(total / limit);
    return {
        data,
        meta: {
            total,
            page,
            limit,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1,
        },
    };
}
//# sourceMappingURL=pagination.js.map