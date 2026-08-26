import type { Prize } from "../types.js";

export function isValidPrize(p: unknown): p is Prize {
  if (!p || typeof p !== "object") return false;
  const o = p as Prize;
  return (
    typeof o.id === "string" &&
    o.id.length > 0 &&
    typeof o.name === "string" &&
    o.name.trim().length > 0 &&
    typeof o.imagePath === "string" &&
    o.imagePath.length > 0 &&
    typeof o.order === "number" &&
    typeof o.quantity === "number" &&
    Number.isInteger(o.quantity) &&
    o.quantity >= 1
  );
}
