import { describe, it, expect } from "vitest";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { JsonStore } from "../src/store/jsonStore.js";

describe("JsonStore", () => {
  it("roundtrips JSON", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "lottery-store-"));
    const tmpFile = path.join(dir, "n.json");
    const store = new JsonStore<{ n: number }>(tmpFile, { n: 0 });
    await store.write({ n: 3 });
    expect(await store.read()).toEqual({ n: 3 });
    const onDisk = JSON.parse(await readFile(tmpFile, "utf8")) as { n: number };
    expect(onDisk).toEqual({ n: 3 });
  });

  it("returns fallback when file missing", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "lottery-store-"));
    const tmpFile = path.join(dir, "missing.json");
    const store = new JsonStore<{ n: number }>(tmpFile, { n: 7 });
    expect(await store.read()).toEqual({ n: 7 });
  });
});
