import { describe, expect, it } from "vitest";
import request from "supertest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createApp } from "../src/index.js";

describe("production static hosting", () => {
  it("serves built index.html at root", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lottery-dist-"));
    const index = path.join(tmp, "index.html");
    fs.writeFileSync(index, "<html><body>LOTTERY_APP</body></html>");
    const app = createApp({ clientDist: tmp });
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.text).toContain("LOTTERY_APP");
  });

  it("SPA fallback returns index.html for /admin", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lottery-dist-"));
    fs.writeFileSync(path.join(tmp, "index.html"), "<html><body>SPA</body></html>");
    const app = createApp({ clientDist: tmp });
    const res = await request(app).get("/admin");
    expect(res.status).toBe(200);
    expect(res.text).toContain("SPA");
  });

  it("still serves /api/health when clientDist set", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lottery-dist-"));
    fs.writeFileSync(path.join(tmp, "index.html"), "ok");
    const app = createApp({ clientDist: tmp });
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
