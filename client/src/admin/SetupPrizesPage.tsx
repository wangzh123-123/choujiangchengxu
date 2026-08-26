import { useEffect, useRef, useState } from "react";
import type { Prize } from "../api/types";

type PreviewMap = Record<string, string>;

export function SetupPrizesPage() {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [previews, setPreviews] = useState<PreviewMap>({});
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const previewsRef = useRef<PreviewMap>({});

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/setup/prizes");
        if (res.status === 404) {
          if (!cancelled) setAvailable(false);
          return;
        }
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { message?: string };
          throw new Error(data.message ?? `HTTP ${res.status}`);
        }
        const list = (await res.json()) as Prize[];
        if (!cancelled) {
          setPrizes(list);
          setAvailable(true);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "加载失败");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    previewsRef.current = previews;
  }, [previews]);

  useEffect(() => {
    return () => {
      for (const url of Object.values(previewsRef.current)) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

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
        quantity: 1,
      },
    ]);
  }

  function removePrize(index: number) {
    setPrizes((list) => list.filter((_, i) => i !== index));
  }

  async function uploadImage(index: number, file: File) {
    setError(null);
    setMessage(null);
    const previewUrl = URL.createObjectURL(file);
    setPreviews((prev) => {
      const prize = prizes[index];
      if (prize && prev[prize.id]) {
        URL.revokeObjectURL(prev[prize.id]);
      }
      const next = { ...prev };
      if (prize) next[prize.id] = previewUrl;
      return next;
    });
    try {
      const res = await fetch("/api/setup/prizes/image", {
        method: "POST",
        headers: {
          "Content-Type": file.type || "application/octet-stream",
          "X-Filename": file.name,
        },
        body: file,
      });
      const data = (await res.json().catch(() => ({}))) as {
        message?: string;
        imagePath?: string;
      };
      if (!res.ok) {
        throw new Error(data.message ?? `HTTP ${res.status}`);
      }
      if (typeof data.imagePath === "string" && data.imagePath.length > 0) {
        updatePrize(index, { imagePath: data.imagePath });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败");
    }
  }

  async function save() {
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/setup/prizes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prizes),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        throw new Error(data.message ?? `HTTP ${res.status}`);
      }
      setMessage("已写入仓库文件，未提交。大屏刷新即可看到");
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    }
  }

  if (available === null) {
    return (
      <div className="admin-page">
        {error ? <p className="error">{error}</p> : <p>加载中…</p>}
      </div>
    );
  }

  if (!available) {
    return (
      <div className="admin-page">
        <p>仅本地配奖可用</p>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <h1>本地配奖</h1>
      </header>

      <section className="admin-card">
        <h2>奖品清单</h2>
        <p className="sub">保存写入仓库 catalog，不会自动 git 提交。</p>
        {prizes.map((p, index) => (
          <div className="admin-row" key={p.id}>
            <label>
              ID
              <span>{p.id}</span>
            </label>
            <label>
              名称
              <input
                value={p.name}
                onChange={(e) => updatePrize(index, { name: e.target.value })}
              />
            </label>
            <label>
              数量
              <input
                type="number"
                min={1}
                value={p.quantity}
                onChange={(e) => updatePrize(index, { quantity: Number(e.target.value) })}
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
            <label>
              图片
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadImage(index, file);
                  e.target.value = "";
                }}
              />
            </label>
            {previews[p.id] ? (
              <img src={previews[p.id]} alt={p.name} style={{ maxHeight: 64 }} />
            ) : null}
            <span className="sub">{p.imagePath}</span>
            <button type="button" className="danger" onClick={() => removePrize(index)}>
              删除
            </button>
          </div>
        ))}
        <div className="admin-actions">
          <button type="button" onClick={addPrize}>
            添加奖品
          </button>
          <button type="button" className="primary" onClick={() => void save()}>
            保存
          </button>
        </div>
        {message && <p className="ok">{message}</p>}
        {error && <p className="error">{error}</p>}
      </section>
    </div>
  );
}
