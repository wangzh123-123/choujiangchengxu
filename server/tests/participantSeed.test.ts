import { afterEach, describe, expect, it } from "vitest";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";
import { ParticipantXmlError } from "../src/domain/participantXml.js";
import {
  applyParticipantSeed,
  maybeApplyParticipantSeed,
  shouldApplyParticipantSeed,
} from "../src/domain/participantSeed.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function makeDataDir() {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "lottery-pseed-"));
  await mkdir(path.join(dataDir, "uploads"), { recursive: true });
  return dataDir;
}

function sessionBody(over: Record<string, unknown> = {}) {
  return {
    currentPrizeId: "p1",
    publicScreen: "winner",
    controlBarVisible: false,
    drawPhase: "revealed",
    lastWinnerParticipantId: "old-id",
    lastWinnerPrizeId: "p9",
    ...over,
  };
}

describe("shouldApplyParticipantSeed", () => {
  it("is false only when LOTTERY_SKIP_PARTICIPANT_SEED is 1", () => {
    expect(shouldApplyParticipantSeed({})).toBe(true);
    expect(shouldApplyParticipantSeed({ LOTTERY_SKIP_PARTICIPANT_SEED: "0" })).toBe(true);
    expect(shouldApplyParticipantSeed({ LOTTERY_SKIP_PARTICIPANT_SEED: "1" })).toBe(false);
  });
});

describe("applyParticipantSeed", () => {
  it("creates xml from json then rebuilds json with new ids and clears draw state", async () => {
    const dataDir = await makeDataDir();
    await writeFile(
      path.join(dataDir, "participants.json"),
      JSON.stringify([
        { id: "a", name: "邵心悦" },
        { id: "b", name: "邵景昊" },
      ]),
    );
    await writeFile(
      path.join(dataDir, "winners.json"),
      JSON.stringify([{ prizeId: "p9", participantId: "a", at: "t" }]),
    );
    await writeFile(path.join(dataDir, "presets.json"), JSON.stringify({ p9: ["a"] }));
    await writeFile(path.join(dataDir, "session.json"), JSON.stringify(sessionBody()));

    await applyParticipantSeed(dataDir);

    const xml = await readFile(path.join(dataDir, "participants.xml"), "utf8");
    expect(xml).toContain("邵心悦");
    expect(xml).toContain("邵景昊");
    const list = JSON.parse(await readFile(path.join(dataDir, "participants.json"), "utf8")) as Array<{
      id: string;
      name: string;
    }>;
    expect(list.map((p) => p.name)).toEqual(["邵心悦", "邵景昊"]);
    expect(list[0]?.id).not.toBe("a");
    expect(list[0]?.id).toMatch(UUID_RE);
    expect(list[1]?.id).toMatch(UUID_RE);
    expect(JSON.parse(await readFile(path.join(dataDir, "winners.json"), "utf8"))).toEqual([]);
    expect(JSON.parse(await readFile(path.join(dataDir, "presets.json"), "utf8"))).toEqual({});
    const session = JSON.parse(await readFile(path.join(dataDir, "session.json"), "utf8"));
    expect(session.publicScreen).toBe("enroll");
    expect(session.drawPhase).toBe("idle");
    expect(session.lastWinnerParticipantId).toBeNull();
    expect(session.lastWinnerPrizeId).toBeNull();
    expect(session.currentPrizeId).toBe("p1");
    expect(session.controlBarVisible).toBe(false);
  });

  it("rebuilds from existing xml and drops json-only people", async () => {
    const dataDir = await makeDataDir();
    await writeFile(
      path.join(dataDir, "participants.xml"),
      `<participants>\n  <participant>甲</participant>\n  <participant>乙</participant>\n</participants>\n`,
    );
    await writeFile(
      path.join(dataDir, "participants.json"),
      JSON.stringify([
        { id: "keep-wrong", name: "甲" },
        { id: "extra", name: "丙" },
      ]),
    );
    await writeFile(path.join(dataDir, "winners.json"), JSON.stringify([{ prizeId: "x", participantId: "extra", at: "t" }]));
    await writeFile(path.join(dataDir, "presets.json"), JSON.stringify({ x: ["extra"] }));
    await writeFile(path.join(dataDir, "session.json"), JSON.stringify(sessionBody()));

    await applyParticipantSeed(dataDir);

    const list = JSON.parse(await readFile(path.join(dataDir, "participants.json"), "utf8")) as Array<{
      name: string;
    }>;
    expect(list.map((p) => p.name)).toEqual(["甲", "乙"]);
    expect(JSON.parse(await readFile(path.join(dataDir, "winners.json"), "utf8"))).toEqual([]);
  });

  it("empty xml yields empty json roster", async () => {
    const dataDir = await makeDataDir();
    await writeFile(path.join(dataDir, "participants.xml"), "<participants></participants>\n");
    await writeFile(
      path.join(dataDir, "participants.json"),
      JSON.stringify([{ id: "a", name: "旧" }]),
    );
    await writeFile(path.join(dataDir, "session.json"), JSON.stringify(sessionBody()));
    await applyParticipantSeed(dataDir);
    expect(JSON.parse(await readFile(path.join(dataDir, "participants.json"), "utf8"))).toEqual([]);
  });

  it("does not overwrite json or winners when xml is malformed", async () => {
    const dataDir = await makeDataDir();
    const people = [{ id: "a", name: "甲" }];
    const winners = [{ prizeId: "p", participantId: "a", at: "t" }];
    const presets = { p: ["a"] };
    await writeFile(path.join(dataDir, "participants.xml"), "not-xml");
    await writeFile(path.join(dataDir, "participants.json"), JSON.stringify(people));
    await writeFile(path.join(dataDir, "winners.json"), JSON.stringify(winners));
    await writeFile(path.join(dataDir, "presets.json"), JSON.stringify(presets));
    await writeFile(path.join(dataDir, "session.json"), JSON.stringify(sessionBody({ publicScreen: "draw" })));

    await expect(applyParticipantSeed(dataDir)).rejects.toThrow(ParticipantXmlError);

    expect(JSON.parse(await readFile(path.join(dataDir, "participants.json"), "utf8"))).toEqual(people);
    expect(JSON.parse(await readFile(path.join(dataDir, "winners.json"), "utf8"))).toEqual(winners);
    expect(JSON.parse(await readFile(path.join(dataDir, "presets.json"), "utf8"))).toEqual(presets);
    expect(JSON.parse(await readFile(path.join(dataDir, "session.json"), "utf8")).publicScreen).toBe(
      "draw",
    );
  });
});

describe("maybeApplyParticipantSeed", () => {
  const prev = process.env.LOTTERY_SKIP_PARTICIPANT_SEED;
  afterEach(() => {
    if (prev === undefined) delete process.env.LOTTERY_SKIP_PARTICIPANT_SEED;
    else process.env.LOTTERY_SKIP_PARTICIPANT_SEED = prev;
  });

  it("does not apply when skip is 1", async () => {
    const dataDir = await makeDataDir();
    await writeFile(
      path.join(dataDir, "participants.json"),
      JSON.stringify([{ id: "keep", name: "留" }]),
    );
    await writeFile(
      path.join(dataDir, "participants.xml"),
      `<participants><participant>甲</participant></participants>\n`,
    );
    process.env.LOTTERY_SKIP_PARTICIPANT_SEED = "1";
    await maybeApplyParticipantSeed(dataDir);
    expect(JSON.parse(await readFile(path.join(dataDir, "participants.json"), "utf8"))[0].id).toBe(
      "keep",
    );
  });
});
