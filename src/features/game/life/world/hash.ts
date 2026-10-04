// Дешевий детермінований хеш клітинки: варіації тайлів, розсип дерев.
export function cellHash(i: number, j: number, salt = 0): number {
  let h = (i * 374761393 + j * 668265263 + salt * 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}
