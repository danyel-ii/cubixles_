import { describe, it, expect } from "vitest";
import {
  assertConfiguredChain,
  parseTokenId,
  normalizeAddress,
  buildProvenanceBundle,
} from "../../app/_client/src/data/nft/indexer.ts";
import { CUBIXLES_CONTRACT } from "../../app/_client/src/config/contracts";

describe("provenance shaping", () => {
  it("normalizes addresses and tokenIds", () => {
    expect(parseTokenId("0x10")).toBe("16");
    expect(parseTokenId("42")).toBe("42");
    expect(normalizeAddress("0x000000000000000000000000000000000000dead")).toBe(
      "0x000000000000000000000000000000000000dEaD"
    );
  });

  it("rejects non-configured chainId", () => {
    const wrongChain = 10;
    expect(() => assertConfiguredChain(wrongChain)).toThrow(/unsupported/i);
  });

  it("enforces selection bounds for provenance bundles", async () => {
    await expect(
      buildProvenanceBundle(
        [],
        "0x000000000000000000000000000000000000dEaD",
        CUBIXLES_CONTRACT.chainId
      )
    )
      .rejects.toThrow(/1 to 6/i);
    await expect(
      buildProvenanceBundle(
        new Array(7).fill(null).map((_, idx) => ({
          chainId: CUBIXLES_CONTRACT.chainId,
          contractAddress: "0x000000000000000000000000000000000000dEaD",
          tokenId: String(idx + 1),
          name: null,
          collectionName: null,
          tokenUri: null,
          image: null,
          source: "alchemy",
        })),
        "0x000000000000000000000000000000000000dEaD",
        CUBIXLES_CONTRACT.chainId
      )
    ).rejects.toThrow(/1 to 6/i);
  });
});
