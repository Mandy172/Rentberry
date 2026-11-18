import { afterEach, describe, expect, it, vi } from "vitest";
import { requireAdmin } from "./admin.server";

function client(isAdmin: boolean) {
  return { rpc: vi.fn().mockResolvedValue({ data: isAdmin, error: null }) } as never;
}

describe("admin access", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("refuses accounts without the admin role, even with the right password", async () => {
    vi.stubEnv("ADMIN_PASSCODE", "correct-horse-battery");
    await expect(requireAdmin(client(false), "u1", "correct-horse-battery")).rejects.toThrow("Admins only.");
  });

  it("refuses an admin who enters the wrong password", async () => {
    vi.stubEnv("ADMIN_PASSCODE", "correct-horse-battery");
    await expect(requireAdmin(client(true), "u1", "wrong-password")).rejects.toThrow("Wrong admin password.");
  });

  it("refuses everyone while no admin password is set", async () => {
    vi.stubEnv("ADMIN_PASSCODE", "");
    await expect(requireAdmin(client(true), "u1", "")).rejects.toThrow("hasn't been set up");
  });

  it("lets an admin in with the right password", async () => {
    vi.stubEnv("ADMIN_PASSCODE", "correct-horse-battery");
    await expect(requireAdmin(client(true), "u1", "correct-horse-battery")).resolves.toBeUndefined();
  });
});
