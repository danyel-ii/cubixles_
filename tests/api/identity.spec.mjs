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

import { GET } from "../../app/api/identity/route.js";

describe("/api/identity", () => {
  it("rejects missing address", async () => {
    const res = await GET(new Request("http://localhost/api/identity"));
    expect(res.status).toBe(400);
  });
});
