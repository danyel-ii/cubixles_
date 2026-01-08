import { describe, it, expect, vi } from "vitest";

vi.mock("../../src/server/ratelimit.js", () => ({
  checkRateLimit: async () => ({ ok: true }),
}));
vi.mock("../../src/server/request.js", () => ({
  getClientIp: () => "127.0.0.1",
  makeRequestId: () => "test-request-id",
}));
vi.mock("../../src/server/log.js", () => ({
  logRequest: vi.fn(),
}));
vi.mock("../../src/server/auth.js", () => ({
  issueNonce: () => ({ nonce: "nonce123", expiresAt: "2025-01-01T00:00:00.000Z" }),
}));

import { GET } from "../../app/api/nonce/route.js";

describe("/api/nonce", () => {
  it("returns nonce and expiry", async () => {
    const res = await GET(new Request("http://localhost/api/nonce"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.nonce).toBe("nonce123");
    expect(json.expiresAt).toBe("2025-01-01T00:00:00.000Z");
  });
});
