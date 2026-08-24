import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { addParticipant, deleteParticipant, patchParticipant } from "../api/client";
import { EnrollScreen } from "./EnrollScreen";

vi.mock("../api/client", () => ({
  addParticipant: vi.fn(),
  patchParticipant: vi.fn(),
  deleteParticipant: vi.fn(),
}));

describe("EnrollScreen", () => {
  beforeEach(() => {
    vi.mocked(addParticipant).mockReset();
    vi.mocked(patchParticipant).mockReset();
    vi.mocked(deleteParticipant).mockReset();
  });

  it("has name field and no qr or id field", () => {
    render(
      <EnrollScreen participants={[]} winnerIds={new Set()} onChanged={() => undefined} />,
    );
    expect(screen.getByText("参与人员")).toBeInTheDocument();
    expect(screen.getByLabelText("姓名")).toBeInTheDocument();
    expect(screen.queryByText(/扫码/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/用户 ID/)).not.toBeInTheDocument();
    expect(screen.queryByAltText(/二维码/)).not.toBeInTheDocument();
  });

  it("adds a name", async () => {
    vi.mocked(addParticipant).mockResolvedValue({ id: "u1", name: "张三" });
    const onChanged = vi.fn();
    render(
      <EnrollScreen participants={[]} winnerIds={new Set()} onChanged={onChanged} />,
    );
    fireEvent.change(screen.getByLabelText("姓名"), { target: { value: "张三" } });
    fireEvent.click(screen.getByRole("button", { name: "添加" }));
    await waitFor(() => expect(addParticipant).toHaveBeenCalledWith("张三"));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it("renames on blur", async () => {
    vi.mocked(patchParticipant).mockResolvedValue({ id: "u1", name: "李四" });
    render(
      <EnrollScreen
        participants={[{ id: "u1", name: "张三" }]}
        winnerIds={new Set()}
        onChanged={() => undefined}
      />,
    );
    const input = screen.getByDisplayValue("张三");
    fireEvent.change(input, { target: { value: "李四" } });
    fireEvent.blur(input);
    await waitFor(() => expect(patchParticipant).toHaveBeenCalledWith("u1", "李四"));
  });

  it("disables delete for winners", () => {
    render(
      <EnrollScreen
        participants={[{ id: "u1", name: "张三" }]}
        winnerIds={new Set(["u1"])}
        onChanged={() => undefined}
      />,
    );
    expect(screen.getByRole("button", { name: "删除" })).toBeDisabled();
  });

  it("deletes a non-winner", async () => {
    vi.mocked(deleteParticipant).mockResolvedValue(undefined);
    render(
      <EnrollScreen
        participants={[{ id: "u1", name: "张三" }]}
        winnerIds={new Set()}
        onChanged={() => undefined}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "删除" }));
    await waitFor(() => expect(deleteParticipant).toHaveBeenCalledWith("u1"));
  });
});
