export function moveItem<T extends { id?: string }>(items: T[], sourceId: string, targetId: string): T[] {
  const from = items.findIndex(item => item.id === sourceId);
  const to = items.findIndex(item => item.id === targetId);
  if (from < 0 || to < 0 || from === to) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function replaceGroupOrder<T extends { id?: string }>(all: T[], reordered: T[]): T[] {
  const ids = new Set(reordered.map(item => item.id));
  let index = 0;
  return all.map(item => ids.has(item.id) ? reordered[index++] : item);
}
