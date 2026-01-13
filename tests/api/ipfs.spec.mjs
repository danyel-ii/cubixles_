import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/server/ratelimit.js", () => ({
  checkRateLimit: vi.fn(async () => ({ ok: true })),
}));
vi.mock("../../src/server/request.js", () => ({
  getClientIp: () => "127.0.0.1",
  makeRequestId: () => "test-request-id",
}));
vi.mock("../../src/server/log.js", () => ({
  logRequest: vi.fn(),
}));
vi.mock("../../src/server/safe-fetch.js", () => ({
  safeFetch: vi.fn(),
  getHostAllowlist: vi.fn(() => ["w3s.link", "ipfs.io"]),
}));

import { GET } from "../../app/api/ipfs/route.js";

describe("/api/ipfs", () => {
  beforeEach(async () => {
    const { safeFetch } = await import("../../src/server/safe-fetch.js");
    safeFetch.mockReset();
  });

  it("rejects missing url", async () => {
    const res = await GET(new Request("http://localhost/api/ipfs"));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.requestId).toBe("test-request-id");
  });

  it("returns 429 when rate limited", async () => {
    const { checkRateLimit } = await import("../../src/server/ratelimit.js");
    checkRateLimit.mockResolvedValueOnce({ ok: false });
    const res = await GET(
      new Request("http://localhost/api/ipfs?url=ipfs://bafybeihash/asset.png")
    );
    expect(res.status).toBe(429);
  });

  it("returns 502 when gateways fail", async () => {
    const { safeFetch } = await import("../../src/server/safe-fetch.js");
    safeFetch.mockRejectedValue(new Error("Gateway failure"));
    const res = await GET(
      new Request("http://localhost/api/ipfs?url=ipfs://bafybeihash/asset.png")
    );
    expect(res.status).toBe(502);
  });

  it("returns gateway response on success", async () => {
    const { safeFetch } = await import("../../src/server/safe-fetch.js");
    const body = JSON.stringify({ ok: true });
    safeFetch.mockResolvedValue({
      response: new Response(body, {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
      buffer: Buffer.from(body),
    });
    const res = await GET(
      new Request("http://localhost/api/ipfs?url=ipfs://bafybeihash/manifest.json")
    );
    expect(res.status).toBe(200);
  });
});
