export function hundredNames(): string[] {
  return Array.from({ length: 100 }, (_, i) => `用户${String(i + 1).padStart(3, "0")}`);
}
