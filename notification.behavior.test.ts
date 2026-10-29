import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();

vi.mock("./_core/env", () => ({
  ENV: {
    forgeApiUrl: "https://notifications.example.test/",
    forgeApiKey: "test-key",
  },
}));

vi.stubGlobal("fetch", fetchMock);

const { notifyOwner } = await import("./_core/notification");

describe("owner notification delivery", () => {
  beforeEach(() => fetchMock.mockReset());

  it("reports successful operational alert delivery", async () => {
    fetchMock.mockResolvedValue({ ok: true });

    await expect(notifyOwner({ title: "Operational status", content: "A review workflow requires attention." })).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("returns a safe false result when the notification service rejects a delivery", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503, statusText: "Unavailable", text: vi.fn(async () => "") });

    await expect(notifyOwner({ title: "Operational status", content: "A review workflow requires attention." })).resolves.toBe(false);
  });
});
