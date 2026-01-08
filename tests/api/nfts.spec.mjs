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
vi.mock("../../src/server/env.js", () => ({
  requireEnv: () => "alchemy-key",
  readEnvBool: () => false,
}));
vi.mock("../../src/server/cache.js", () => ({
  getCache: async () => null,
  setCache: vi.fn(async () => {}),
}));

import { POST } from "../../app/api/nfts/route.js";

const alchemyResponse = {
  ownedNfts: [
    {
      contract: { address: "0x000000000000000000000000000000000000dEaD" },
      tokenId: "1",
      tokenType: "ERC721",
      name: "Test NFT",
      tokenUri: { raw: "ipfs://token" },
      collection: { name: "Test Collection" },
      image: { cachedUrl: "https://img", originalUrl: "https://img" },
      metadata: { name: "Test" },
      raw: { metadata: { name: "Test" } },
    },
  ],
};

describe("/api/nfts", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => alchemyResponse,
    }));
  });

  it("returns minimized NFT fields", async () => {
    const res = await POST(
      new Request("http://localhost/api/nfts", {
        method: "POST",
        body: JSON.stringify({
          mode: "alchemy",
          chainId: 1,
          path: "getNFTsForOwner",
          query: { owner: "0x000000000000000000000000000000000000dEaD" },
        }),
      })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ownedNfts?.length).toBe(1);
    expect(json.ownedNfts[0].contract.address).toBe(
      "0x000000000000000000000000000000000000dEaD"
    );
    expect(json.ownedNfts[0]).toHaveProperty("tokenId");
  });

  it("returns 429 when rate limited", async () => {
    const { checkRateLimit } = await import("../../src/server/ratelimit.js");
    checkRateLimit.mockResolvedValueOnce({ ok: false });
    const res = await POST(
      new Request("http://localhost/api/nfts", {
        method: "POST",
        body: JSON.stringify({
          mode: "alchemy",
          chainId: 1,
          path: "getNFTsForOwner",
          query: { owner: "0x000000000000000000000000000000000000dEaD" },
        }),
      })
    );
    expect(res.status).toBe(429);
  });
});
