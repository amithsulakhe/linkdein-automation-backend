export function parsePagination(query, { maxLimit = 100, defaultLimit = 20 } = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

export function paginatedResponse(items, total, page, limit) {
  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}
