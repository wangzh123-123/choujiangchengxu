import { describe, expect, it } from "vitest";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getPaths } from "../src/store/paths.js";
import {
  PARTICIPANT_XML_PARSE_ERROR,
  ParticipantXmlError,
  parseParticipantsXml,
  serializeParticipantsXml,
  writeParticipantsXml,
} from "../src/domain/participantXml.js";

describe("getPaths participantsXml", () => {
  it("joins participants.xml under the data dir", () => {
    const p = getPaths(path.join("tmp", "data"));
    expect(p.participantsXml).toBe(path.join("tmp", "data", "participants.xml"));
  });
});

describe("serializeParticipantsXml / parseParticipantsXml", () => {
  it("round-trips names in order", () => {
    const xml = serializeParticipantsXml(["邵心悦", "邵景昊"]);
    expect(xml).toContain("<participants>");
    expect(parseParticipantsXml(xml)).toEqual(["邵心悦", "邵景昊"]);
  });

  it("serializes empty list as empty participants element", () => {
    expect(serializeParticipantsXml([])).toBe("<participants></participants>\n");
    expect(parseParticipantsXml("<participants></participants>")).toEqual([]);
    expect(parseParticipantsXml("<participants/>")).toEqual([]);
  });

  it("escapes and unescapes special characters", () => {
    const names = [`甲&乙`, `A<B>`, `x"y"`, `o'p`];
    expect(parseParticipantsXml(serializeParticipantsXml(names))).toEqual(names);
  });

  it("skips empty tags and keeps first duplicate", () => {
    const raw = `<participants>
  <participant></participant>
  <participant>甲</participant>
  <participant>  </participant>
  <participant>甲</participant>
  <participant>乙</participant>
</participants>`;
    expect(parseParticipantsXml(raw)).toEqual(["甲", "乙"]);
  });

  it("accepts optional xml declaration", () => {
    const raw = `<?xml version="1.0" encoding="UTF-8"?>\n<participants><participant>甲</participant></participants>`;
    expect(parseParticipantsXml(raw)).toEqual(["甲"]);
  });

  it("throws ParticipantXmlError for garbage", () => {
    expect(() => parseParticipantsXml("not xml")).toThrow(ParticipantXmlError);
    expect(() => parseParticipantsXml("<root></root>")).toThrow(PARTICIPANT_XML_PARSE_ERROR);
    expect(() => parseParticipantsXml("<participants><foo/></participants>")).toThrow(
      ParticipantXmlError,
    );
  });

  it("throws when participant tags are nested or unclosed", () => {
    expect(() =>
      parseParticipantsXml(
        "<participants><participant>甲<participant>乙</participant></participants>",
      ),
    ).toThrow(ParticipantXmlError);
  });

  it("skips empty self-closing participant and keeps following name", () => {
    expect(
      parseParticipantsXml(
        "<participants><participant /><participant>甲</participant></participants>",
      ),
    ).toEqual(["甲"]);
  });
});

describe("writeParticipantsXml", () => {
  it("writes utf8 file that parses back", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "lottery-xml-"));
    const file = path.join(dir, "participants.xml");
    await writeParticipantsXml(file, ["甲", "乙"]);
    const raw = await readFile(file, "utf8");
    expect(parseParticipantsXml(raw)).toEqual(["甲", "乙"]);
  });
});
