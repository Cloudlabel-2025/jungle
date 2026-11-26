export function pagination(total, requestedPage = 1, pageSize = 5) {
  const size = Math.max(1, Math.floor(pageSize) || 5);
  const pages = Math.max(1, Math.ceil(total / size));
  const page = Math.max(1, Math.min(pages, Math.floor(requestedPage) || 1));
  const start = (page - 1) * size;
  const first = Math.max(1, Math.min(page - 2, pages - 4));
  return { page, pages, start, end: Math.min(start + size, total), size,
    numbers: Array.from({ length: Math.min(5, pages) }, (_, i) => first + i) };
}
