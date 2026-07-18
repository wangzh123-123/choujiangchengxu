import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AdminLogin } from "./AdminLogin";

describe("AdminLogin", () => {
  it("shows login form when locked", () => {
    render(<AdminLogin onLoggedIn={() => undefined} />);
    expect(screen.getByLabelText(/口令/)).toBeInTheDocument();
  });
});
