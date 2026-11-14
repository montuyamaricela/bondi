export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

export function uniquePageItems<T>(pages: CursorPage<T>[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return pages
    .flatMap((page) => page.items)
    .filter((item) => {
      const id = key(item);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
}
