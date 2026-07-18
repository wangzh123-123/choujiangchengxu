import { useState, type FormEvent } from "react";
import { addParticipant } from "../api/client";

type Props = {
  onAdded?: () => void;
};

export function EnrollScreen({ onAdded }: Props) {
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    try {
      await addParticipant(id.trim(), name.trim());
      setOk("添加成功");
      setId("");
      setName("");
      onAdded?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "添加失败");
    }
  }

  return (
    <section className="screen enroll-screen">
      <h1>扫码参与</h1>
      <p className="sub">本版为展示用二维码，请使用下方表单添加抽奖用户</p>
      <div className="qr-wrap">
        <img src="/fake-qr.svg" alt="假二维码" />
      </div>
      <form className="enroll-form" onSubmit={onSubmit}>
        <label>
          用户 ID
          <input value={id} onChange={(e) => setId(e.target.value)} required />
        </label>
        <label>
          用户名称
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <button type="submit">添加抽奖用户</button>
      </form>
      {error ? <p className="error">{error}</p> : null}
      {ok ? <p className="ok">{ok}</p> : null}
    </section>
  );
}
