export interface PaginationParams {
  page: number
  limit: number
}

export interface PaginatedResult<T> {
  data: T[]
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

export function getPaginationParams(query: Record<string, unknown>): PaginationParams {
  const page = Math.max(1, Number(query['page']) || 1)
  const limit = Math.min(9999, Math.max(1, Number(query['limit']) || 20))
  return { page, limit }
}

export function buildPaginatedResult<T>(
  data: T[],
  total: number,
  { page, limit }: PaginationParams
): PaginatedResult<T> {
  const totalPages = Math.ceil(total / limit)
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
  }
}
