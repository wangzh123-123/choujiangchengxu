import { afterEach, describe, expect, it } from "vitest";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";
import {
  applyPrizeSeed,
  maybeApplyPrizeSeed,
  shouldApplyPrizeSeed,
} from "../src/domain/prizeCatalog.js";

async function makeDirs() {
  const root = await mkdtemp(path.join(os.tmpdir(), "lottery-seed-"));
  const catalogDir = path.join(root, "catalog");
  const dataDir = path.join(root, "data");
  await mkdir(path.join(catalogDir, "uploads"), { recursive: true });
  await mkdir(path.join(dataDir, "uploads"), { recursive: true });
  return { catalogDir, dataDir };
}

describe("shouldApplyPrizeSeed", () => {
  it("is false only when LOTTERY_SKIP_PRIZE_SEED is 1", () => {
    expect(shouldApplyPrizeSeed({})).toBe(true);
    expect(shouldApplyPrizeSeed({ LOTTERY_SKIP_PRIZE_SEED: "0" })).toBe(true);
    expect(shouldApplyPrizeSeed({ LOTTERY_SKIP_PRIZE_SEED: "1" })).toBe(false);
  });
});

describe("applyPrizeSeed", () => {
  it("overwrites data prizes and copies referenced images", async () => {
    const { catalogDir, dataDir } = await makeDirs();
    await writeFile(
      path.join(catalogDir, "prizes.json"),
      JSON.stringify([
        { id: "p2", name: "二", imagePath: "b.png", order: 2, quantity: 1 },
        { id: "p1", name: "一", imagePath: "a.png", order: 0, quantity: 3 },
      ]),
    );
    await writeFile(path.join(catalogDir, "uploads", "a.png"), "IMG-A");
    await writeFile(path.join(catalogDir, "uploads", "b.png"), "IMG-B");
    await writeFile(
      path.join(dataDir, "prizes.json"),
      JSON.stringify([{ id: "old", name: "旧", imagePath: "x", order: 0, quantity: 1 }]),
    );
    await writeFile(
      path.join(dataDir, "session.json"),
      JSON.stringify({
        currentPrizeId: "missing",
        publicScreen: "enroll",
        controlBarVisible: true,
        drawPhase: "idle",
        lastWinnerParticipantId: null,
        lastWinnerPrizeId: null,
      }),
    );
    const participants = [{ id: "u1", name: "甲" }];
    const presets = { p9: ["u1"] };
    const winners = [{ prizeId: "p9", participantId: "u1", at: "t" }];
    await writeFile(path.join(dataDir, "participants.json"), JSON.stringify(participants));
    await writeFile(path.join(dataDir, "presets.json"), JSON.stringify(presets));
    await writeFile(path.join(dataDir, "winners.json"), JSON.stringify(winners));

    await applyPrizeSeed(catalogDir, dataDir);

    const prizes = JSON.parse(await readFile(path.join(dataDir, "prizes.json"), "utf8")) as Array<{
      id: string;
    }>;
    expect(prizes.map((p) => p.id).sort()).toEqual(["p1", "p2"]);
    expect(await readFile(path.join(dataDir, "uploads", "a.png"), "utf8")).toBe("IMG-A");
    expect(JSON.parse(await readFile(path.join(dataDir, "session.json"), "utf8")).currentPrizeId).toBe(
      "p1",
    );
    expect(JSON.parse(await readFile(path.join(dataDir, "participants.json"), "utf8"))).toEqual(
      participants,
    );
    expect(JSON.parse(await readFile(path.join(dataDir, "presets.json"), "utf8"))).toEqual(presets);
    expect(JSON.parse(await readFile(path.join(dataDir, "winners.json"), "utf8"))).toEqual(winners);
  });

  it("keeps currentPrizeId when it still exists", async () => {
    const { catalogDir, dataDir } = await makeDirs();
    await writeFile(
      path.join(catalogDir, "prizes.json"),
      JSON.stringify([{ id: "p1", name: "一", imagePath: "a.png", order: 0, quantity: 1 }]),
    );
    await writeFile(
      path.join(dataDir, "session.json"),
      JSON.stringify({
        currentPrizeId: "p1",
        publicScreen: "prize",
        controlBarVisible: true,
        drawPhase: "idle",
        lastWinnerParticipantId: null,
        lastWinnerPrizeId: null,
      }),
    );
    await applyPrizeSeed(catalogDir, dataDir);
    expect(JSON.parse(await readFile(path.join(dataDir, "session.json"), "utf8")).currentPrizeId).toBe(
      "p1",
    );
  });

  it("sets currentPrizeId null when catalog is empty", async () => {
    const { catalogDir, dataDir } = await makeDirs();
    await writeFile(
      path.join(dataDir, "session.json"),
      JSON.stringify({
        currentPrizeId: "p1",
        publicScreen: "enroll",
        controlBarVisible: true,
        drawPhase: "idle",
        lastWinnerParticipantId: null,
        lastWinnerPrizeId: null,
      }),
    );
    await applyPrizeSeed(catalogDir, dataDir);
    const prizes = JSON.parse(await readFile(path.join(dataDir, "prizes.json"), "utf8"));
    expect(prizes).toEqual([]);
    expect(JSON.parse(await readFile(path.join(dataDir, "session.json"), "utf8")).currentPrizeId).toBe(
      null,
    );
  });
});

describe("maybeApplyPrizeSeed", () => {
  const prev = process.env.LOTTERY_SKIP_PRIZE_SEED;
  afterEach(() => {
    if (prev === undefined) delete process.env.LOTTERY_SKIP_PRIZE_SEED;
    else process.env.LOTTERY_SKIP_PRIZE_SEED = prev;
  });

  it("does not copy when skip is 1", async () => {
    const { catalogDir, dataDir } = await makeDirs();
    await writeFile(
      path.join(catalogDir, "prizes.json"),
      JSON.stringify([{ id: "p1", name: "一", imagePath: "a.png", order: 0, quantity: 1 }]),
    );
    await writeFile(
      path.join(dataDir, "prizes.json"),
      JSON.stringify([{ id: "keep", name: "留", imagePath: "x", order: 0, quantity: 1 }]),
    );
    process.env.LOTTERY_SKIP_PRIZE_SEED = "1";
    await maybeApplyPrizeSeed(catalogDir, dataDir);
    expect(JSON.parse(await readFile(path.join(dataDir, "prizes.json"), "utf8"))[0].id).toBe("keep");
  });
});
