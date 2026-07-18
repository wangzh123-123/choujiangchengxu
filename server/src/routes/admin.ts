import { Router } from "express";
import {
  createToken,
  grantSession,
  requireAdmin,
  verifyPassphrase,
} from "../auth/adminAuth.js";

export function adminRouter(): Router {
  const router = Router();

  router.post("/api/admin/login", async (req, res) => {
    const passphrase = typeof req.body?.passphrase === "string" ? req.body.passphrase : "";
    if (!(await verifyPassphrase(passphrase))) {
      res.status(401).json({ message: "口令错误" });
      return;
    }
    const token = createToken();
    grantSession(token);
    res.setHeader(
      "Set-Cookie",
      `lottery_admin=${token}; Path=/; HttpOnly; SameSite=Lax`,
    );
    res.json({ ok: true, token });
  });

  router.get("/api/admin/me", requireAdmin, (_req, res) => {
    res.json({ ok: true });
  });

  return router;
}
