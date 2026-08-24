import { useEffect, useState, type FormEvent } from "react";
import { addParticipant, deleteParticipant, patchParticipant } from "../api/client";
import type { Participant } from "../api/types";

type Props = {
  participants: Participant[];
  winnerIds: Set<string>;
  onChanged?: () => void;
};

export function EnrollScreen({ participants, winnerIds, onChanged }: Props) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    try {
      await addParticipant(name.trim());
      setOk("添加成功");
      setName("");
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "添加失败");
    }
  }

  return (
    <section className="screen enroll-screen">
      <h1>参与人员</h1>
      <form className="enroll-form" onSubmit={onSubmit}>
        <label>
          姓名
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>
        <button type="submit">添加</button>
      </form>
      {error ? <p className="error">{error}</p> : null}
      {ok ? <p className="ok">{ok}</p> : null}
      <ul className="enroll-list">
        {participants.map((p) => (
          <EnrollRow
            key={p.id}
            participant={p}
            locked={winnerIds.has(p.id)}
            onChanged={onChanged}
            onError={setError}
          />
        ))}
      </ul>
    </section>
  );
}

function EnrollRow({
  participant,
  locked,
  onChanged,
  onError,
}: {
  participant: Participant;
  locked: boolean;
  onChanged?: () => void;
  onError: (message: string | null) => void;
}) {
  const [draft, setDraft] = useState(participant.name);

  useEffect(() => {
    setDraft(participant.name);
  }, [participant.name]);

  async function save() {
    const next = draft.trim();
    if (!next) {
      setDraft(participant.name);
      onError("姓名不能为空");
      return;
    }
    if (next === participant.name) {
      return;
    }
    try {
      onError(null);
      await patchParticipant(participant.id, next);
      onChanged?.();
    } catch (err) {
      setDraft(participant.name);
      onError(err instanceof Error ? err.message : "改名失败");
    }
  }

  async function onDelete() {
    try {
      onError(null);
      await deleteParticipant(participant.id);
      onChanged?.();
    } catch (err) {
      onError(err instanceof Error ? err.message : "删除失败");
    }
  }

  return (
    <li className="enroll-row">
      <input
        aria-label={`姓名-${participant.id}`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void save()}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void save();
          }
        }}
      />
      <button type="button" disabled={locked} onClick={() => void onDelete()}>
        删除
      </button>
    </li>
  );
}
