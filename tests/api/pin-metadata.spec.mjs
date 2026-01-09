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
  verifyNonce: async () => ({ ok: true }),
  verifySignature: async () => ({ ok: true, address: "0x000000000000000000000000000000000000dEaD" }),
}));
vi.mock("../../src/server/pinata.js", () => ({
  hashPayload: () => "hash",
  getCachedCid: async () => null,
  setCachedCid: vi.fn(async () => {}),
  pinJson: async () => "cid123",
}));

import { POST } from "../../app/api/pin/metadata/route.js";

const validPayload = {
  name: "cubixles_ #1",
  description: "test",
  external_url: "https://example.com/m/1",
  image: "ipfs://cid/gif_0001.gif",
  provenance: {
    refs: [
      {
        contractAddress: "0x000000000000000000000000000000000000dEaD",
        tokenId: "1",
      },
    ],
  },
};

describe("/api/pin/metadata", () => {
  it("rejects missing signature", async () => {
    const res = await POST(
      new Request("http://localhost/api/pin/metadata", {
        method: "POST",
        body: JSON.stringify({
          address: "0x000000000000000000000000000000000000dEaD",
          nonce: "nonce",
          payload: validPayload,
        }),
      })
    );
    expect(res.status).toBe(400);
  });

  it("rejects oversized payloads", async () => {
    const bigString = "x".repeat(60_000);
    const res = await POST(
      new Request("http://localhost/api/pin/metadata", {
        method: "POST",
        body: JSON.stringify({
          address: "0x000000000000000000000000000000000000dEaD",
          nonce: "nonce",
          signature: "0xsig",
          payload: { ...validPayload, extra: bigString },
        }),
      })
    );
    expect(res.status).toBe(413);
  });

  it("returns a CID for valid payloads", async () => {
    const res = await POST(
      new Request("http://localhost/api/pin/metadata", {
        method: "POST",
        body: JSON.stringify({
          address: "0x000000000000000000000000000000000000dEaD",
          nonce: "nonce",
          signature: "0xsig",
          payload: validPayload,
        }),
      })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.cid).toBe("cid123");
    expect(json.tokenURI).toBe("ipfs://cid123");
    expect(json.metadataHash).toBe("0xhash");
  });
});
