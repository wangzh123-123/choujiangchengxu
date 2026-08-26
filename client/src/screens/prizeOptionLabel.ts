export function prizeOptionLabel(p: { name: string; drawnCount: number; quantity: number }): string {
  const complete = p.drawnCount >= p.quantity;
  if (complete) {
    return `${p.name}（已抽）`;
  }
  if (p.quantity === 1) {
    return p.name;
  }
  return `${p.name}（已抽 ${p.drawnCount}/${p.quantity}）`;
}
