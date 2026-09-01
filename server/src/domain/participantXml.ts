import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export const PARTICIPANT_XML_PARSE_ERROR = "participants.xml 无法解析";

export class ParticipantXmlError extends Error {
  constructor(message = PARTICIPANT_XML_PARSE_ERROR) {
    super(message);
    this.name = "ParticipantXmlError";
  }
}

const ESCAPE: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

export function escapeXmlText(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ESCAPE[ch] ?? ch);
}

export function unescapeXmlText(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

export function serializeParticipantsXml(names: string[]): string {
  if (names.length === 0) {
    return "<participants></participants>\n";
  }
  const inner = names
    .map((name) => `  <participant>${escapeXmlText(name)}</participant>`)
    .join("\n");
  return `<participants>\n${inner}\n</participants>\n`;
}

export function parseParticipantsXml(raw: string): string[] {
  const trimmed = raw.replace(/^\uFEFF/, "").trim();
  const withoutDecl = trimmed.replace(/^<\?xml[^?]*\?>\s*/i, "");
  if (/^<participants(?:\s[^>]*)?\/>\s*$/.test(withoutDecl)) {
    return [];
  }
  const root = withoutDecl.match(/^<participants(?:\s[^>]*)?>([\s\S]*)<\/participants>\s*$/);
  if (!root) {
    throw new ParticipantXmlError();
  }
  const inner = root[1] ?? "";
  // Self-closing: `\s[^/>]*` must not consume `/` before `/>` (e.g. `<participant />`).
  const tagRe = /<participant(?:\s[^/>]*)?\s*(?:\/>|>([\s\S]*?)<\/participant>)/g;
  const leftover = inner.replace(tagRe, " ");
  if (leftover.replace(/\s+/g, "") !== "") {
    throw new ParticipantXmlError();
  }
  const names: string[] = [];
  const seen = new Set<string>();
  const tag = /<participant(?:\s[^/>]*)?\s*(?:\/>|>([\s\S]*?)<\/participant>)/g;
  let match: RegExpExecArray | null = tag.exec(inner);
  while (match) {
    const rawInner = match[1];
    if (rawInner !== undefined && /[<>]/.test(rawInner)) {
      // Names must escape < > as &lt; / &gt; (spec §2.2); raw markup means bad structure.
      throw new ParticipantXmlError();
    }
    const text = unescapeXmlText(rawInner ?? "").trim();
    if (text && !seen.has(text)) {
      seen.add(text);
      names.push(text);
    }
    match = tag.exec(inner);
  }
  return names;
}

export async function writeParticipantsXml(filePath: string, names: string[]): Promise<void> {
  const dir = path.dirname(filePath);
  await mkdir(dir, { recursive: true });
  const tmp = `${filePath}.${process.pid}.tmp`;
  await writeFile(tmp, serializeParticipantsXml(names), "utf8");
  await rename(tmp, filePath);
}
