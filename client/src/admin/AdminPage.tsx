import { useCallback, useEffect, useState } from "react";
import type { Participant, Prize } from "../api/types";
import { AdminLogin, clearAdminToken, getAdminToken } from "./AdminLogin";

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
  const [presets, setPresets] = useState<Record<string, string>>({});
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
    setPresets(presetMap as Record<string, string>);
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

  async function savePrizes() {
    setError(null);
    setMessage(null);
    try {
      await authFetch("/api/prizes", { method: "PUT", body: JSON.stringify(prizes) });
      setMessage("奖品已保存");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    }
  }

  async function savePreset(prizeId: string, participantId: string) {
    setError(null);
    setMessage(null);
    try {
      if (!participantId) {
        await authFetch(`/api/presets/${prizeId}`, { method: "DELETE" });
        setMessage("已清除内定");
      } else {
        await authFetch(`/api/presets/${prizeId}`, {
          method: "PUT",
          body: JSON.stringify({ participantId }),
        });
        setMessage("内定已保存");
      }
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

  function updatePrize(index: number, patch: Partial<Prize>) {
    setPrizes((list) => list.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  function addPrize() {
    setPrizes((list) => [
      ...list,
      {
        id: `prize-${Date.now()}`,
        name: "新奖品",
        imagePath: "prize-default.svg",
        order: list.length,
      },
    ]);
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
        <h2>奖品配置</h2>
        <p className="sub">图片请放到 data/uploads/，此处填文件名（默认 prize-default.svg）</p>
        {prizes.map((p, index) => (
          <div className="admin-row" key={p.id}>
            <label>
              名称
              <input
                value={p.name}
                onChange={(e) => updatePrize(index, { name: e.target.value })}
              />
            </label>
            <label>
              图片文件名
              <input
                value={p.imagePath}
                onChange={(e) => updatePrize(index, { imagePath: e.target.value })}
              />
            </label>
            <label>
              排序
              <input
                type="number"
                value={p.order}
                onChange={(e) => updatePrize(index, { order: Number(e.target.value) })}
              />
            </label>
          </div>
        ))}
        <div className="admin-actions">
          <button type="button" onClick={addPrize}>
            添加奖品
          </button>
          <button type="button" className="primary" onClick={() => void savePrizes()}>
            保存奖品
          </button>
        </div>
      </section>

      <section className="admin-card">
        <h2>内定中奖人</h2>
        <p className="sub">有内定则开奖必中（优先级最高，可覆盖不可重复中奖）</p>
        {prizes.map((p) => (
          <div className="admin-row" key={`preset-${p.id}`}>
            <strong>{p.name}</strong>
            <select
              value={presets[p.id] ?? ""}
              onChange={(e) => void savePreset(p.id, e.target.value)}
            >
              <option value="">未内定（随机）</option>
              {participants.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.id})
                </option>
              ))}
            </select>
          </div>
        ))}
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
