import type { PresetMap, PresetSlots } from "../types.js";

function asId(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizePresetSlots(raw: unknown, quantity: number): PresetSlots {
  const slots: PresetSlots = Array.from({ length: quantity }, () => null);
  if (typeof raw === "string") {
    slots[0] = asId(raw);
    return slots;
  }
  if (!Array.isArray(raw)) {
    return slots;
  }
  for (let i = 0; i < quantity && i < raw.length; i += 1) {
    slots[i] = asId(raw[i]);
  }
  return slots;
}

export function resizePresetSlots(slots: PresetSlots, quantity: number): PresetSlots {
  return normalizePresetSlots(slots, quantity);
}

export function presetSlotAt(slots: PresetSlots, drawIndex: number): string | null {
  if (drawIndex < 0 || drawIndex >= slots.length) {
    return null;
  }
  return slots[drawIndex] ?? null;
}

export function uniqueNonEmptyIds(slots: PresetSlots): boolean {
  const ids = slots.filter((s): s is string => typeof s === "string" && s.length > 0);
  return new Set(ids).size === ids.length;
}

export function clearParticipantFromPresets(presets: PresetMap, participantId: string): PresetMap {
  const next: PresetMap = {};
  for (const [prizeId, slots] of Object.entries(presets)) {
    const updated = slots.map((s) => (s === participantId ? null : s));
    if (updated.some((s) => s !== null)) {
      next[prizeId] = updated;
    }
  }
  return next;
}
