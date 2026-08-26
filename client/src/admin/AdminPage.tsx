import { useCallback, useEffect, useState } from "react";
import type { Participant, Prize } from "../api/types";
import { AdminLogin, clearAdminToken, getAdminToken } from "./AdminLogin";

function asSlotMap(raw: unknown): Record<string, Array<string | null>> {
  if (!raw || typeof raw !== "object") {
    return {};
  }
  const out: Record<string, Array<string | null>> = {};
  for (const [prizeId, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "string") {
      out[prizeId] = [value.length > 0 ? value : null];
    } else if (Array.isArray(value)) {
      out[prizeId] = value.map((slot) =>
        typeof slot === "string" && slot.length > 0 ? slot : null,
      );
    }
  }
  return out;
}

async function authFetch(path: string, init: RequestInit = {}) {
  const token = getAdminToken();
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(path, { ...init, headers });
  if (res.status === 204) {
    return null;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { message?: string }).message ?? `HTTP ${res.status}`);
  }
  return data;
}

export function AdminPage() {
  const [authed, setAuthed] = useState(() => Boolean(getAdminToken()));
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [presets, setPresets] = useState<Record<string, Array<string | null>>>({});
  const [winners, setWinners] = useState<Array<{ prizeId: string; participantId: string }>>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [p, people, presetMap, view] = await Promise.all([
      fetch("/api/prizes").then((r) => r.json()),
      fetch("/api/participants").then((r) => r.json()),
      authFetch("/api/presets"),
      fetch("/api/public/view").then((r) => r.json()),
    ]);
    setPrizes(p as Prize[]);
    setParticipants(people as Participant[]);
    setPresets(asSlotMap(presetMap));
    setWinners((view as { winners: Array<{ prizeId: string; participantId: string }> }).winners);
  }, []);

  useEffect(() => {
    if (!authed) return;
    void load().catch((err: unknown) => {
      if (err instanceof Error && /口令|401|管理/.test(err.message)) {
        clearAdminToken();
        setAuthed(false);
      }
      setError(err instanceof Error ? err.message : "加载失败");
    });
  }, [authed, load]);

  if (!authed) {
    return (
      <div className="admin-page">
        <AdminLogin
          onLoggedIn={() => {
            setAuthed(true);
          }}
        />
      </div>
    );
  }

  async function savePresetSlots(prizeId: string, slots: Array<string | null>) {
    setError(null);
    setMessage(null);
    try {
      await authFetch(`/api/presets/${prizeId}`, {
        method: "PUT",
        body: JSON.stringify({ slots }),
      });
      setMessage("内定已保存");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "内定失败");
    }
  }

  async function clearParticipants() {
    if (!window.confirm("确认清空全部参与用户？内定设置也会一并清除。")) {
      return;
    }
    setError(null);
    setMessage(null);
    try {
      await authFetch("/api/participants", { method: "DELETE" });
      setMessage("参与用户已清空");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "清空参与用户失败");
    }
  }

  async function clearWinners() {
    if (!window.confirm("确认清空全部中奖记录？清空后已中奖用户可再次参与抽奖。")) {
      return;
    }
    setError(null);
    setMessage(null);
    try {
      await authFetch("/api/winners", { method: "DELETE" });
      setMessage("中奖记录已清空");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "清空中奖记录失败");
    }
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <h1>抽奖内部管理</h1>
        <div className="admin-actions">
          <a href="/">返回大屏</a>
          <button
            type="button"
            onClick={() => {
              clearAdminToken();
              setAuthed(false);
            }}
          >
            退出
          </button>
        </div>
      </header>

      <section className="admin-card">
        <h2>内定中奖人</h2>
        <p className="sub">可按抽奖次序填写最多 N 个内定，空槽随机。有内定则该次开奖必中（优先级最高，可覆盖不可重复中奖）。</p>
        {prizes.map((p) => {
          const slots = presets[p.id] ?? Array.from({ length: p.quantity }, () => null);
          return (
            <div key={`preset-${p.id}`}>
              <strong>{p.name}</strong>
              <div className="admin-row">
                {Array.from({ length: p.quantity }, (_, i) => (
                  <label key={`${p.id}-${i}`}>
                    第{i + 1}次
                    <select
                      value={slots[i] ?? ""}
                      onChange={(e) => {
                        const next = Array.from({ length: p.quantity }, (__, j) => slots[j] ?? null);
                        next[i] = e.target.value.length > 0 ? e.target.value : null;
                        void savePresetSlots(p.id, next);
                      }}
                    >
                      <option value="">未内定（随机）</option>
                      {participants.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </section>

      <section className="admin-card">
        <h2>已中奖记录</h2>
        {winners.length === 0 ? <p className="sub">暂无</p> : null}
        <ul>
          {winners.map((w) => {
            const prize = prizes.find((p) => p.id === w.prizeId);
            const user = participants.find((u) => u.id === w.participantId);
            return (
              <li key={`${w.prizeId}-${w.participantId}`}>
                {prize?.name ?? w.prizeId} → {user?.name ?? w.participantId}
              </li>
            );
          })}
        </ul>
        <div className="admin-actions">
          <button type="button" className="danger" onClick={() => void clearWinners()}>
            清空中奖记录
          </button>
        </div>
      </section>

      <section className="admin-card">
        <h2>参与用户</h2>
        <p className="sub">当前共 {participants.length} 人</p>
        <ul>
          {participants.map((u) => (
            <li key={u.id}>
              {u.name} ({u.id})
            </li>
          ))}
        </ul>
        <div className="admin-actions">
          <button type="button" className="danger" onClick={() => void clearParticipants()}>
            清空参与用户
          </button>
        </div>
        <p className="sub">清空参与用户时会同时清除内定设置。</p>
      </section>

      {message ? <p className="ok">{message}</p> : null}
      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}
