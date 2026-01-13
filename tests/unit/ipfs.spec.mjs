import { describe, it, expect } from "vitest";
import { resolveUri } from "../../app/_client/src/shared/utils/uri.ts";
import { buildGatewayUrls } from "../../src/shared/ipfs-fetch.js";
import { DEFAULT_IPFS_GATEWAY } from "../../src/shared/uri-policy.js";

describe("ipfs normalization", () => {
  it("resolves ipfs:// to gateway url", () => {
    const resolved = resolveUri("ipfs://bafybeihash");
    expect(resolved?.resolved).toBe(`${DEFAULT_IPFS_GATEWAY}bafybeihash`);
  });

  it("returns original for https URLs", () => {
    const resolved = resolveUri("https://example.com/token.json");
    expect(resolved?.resolved).toBe("https://example.com/token.json");
  });

  it("builds gateway fallback URLs in order", () => {
    const urls = buildGatewayUrls("ipfs://bafybeihash/asset.png");
    expect(urls[0]).toContain("https://w3s.link/ipfs/");
    expect(urls[urls.length - 1]).toContain("https://ipfs.io/ipfs/");
  });
});
