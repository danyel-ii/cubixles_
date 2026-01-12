import { describe, it, expect } from "vitest";
import { buildMintMetadata } from "../../app/_client/src/features/mint/mint-metadata.js";

describe("mint metadata builder", () => {
  it("includes required fields and provenance", () => {
    const selection = [
      {
        chainId: 11155111,
        contractAddress: "0x000000000000000000000000000000000000dEaD",
        tokenId: "42",
        name: "Test NFT",
        collectionName: "Test Collection",
        tokenUri: { original: "ipfs://token", resolved: "https://ipfs.io/ipfs/token" },
        image: { original: "ipfs://image", resolved: "https://ipfs.io/ipfs/image" },
        source: "alchemy",
        collectionFloorEth: 0.5,
        collectionFloorRetrievedAt: "2025-01-01T00:00:00.000Z",
      },
    ];
    const provenanceBundle = {
      chainId: 11155111,
      selectedBy: "0x000000000000000000000000000000000000dEaD",
      retrievedAt: "2025-01-01T00:00:00.000Z",
      nfts: [
        {
          chainId: 11155111,
          contractAddress: "0x000000000000000000000000000000000000dEaD",
          tokenId: "42",
          tokenUri: { original: "ipfs://token", resolved: "https://ipfs.io/ipfs/token" },
          image: { original: "ipfs://image", resolved: "https://ipfs.io/ipfs/image" },
          sourceMetadata: { raw: {} },
          retrievedVia: "alchemy",
          retrievedAt: "2025-01-01T00:00:00.000Z",
        },
      ],
    };

    const metadata = buildMintMetadata({
      tokenId: "123",
      minter: "0x000000000000000000000000000000000000dEaD",
      chainId: 11155111,
      selection,
      provenanceBundle,
      refsFaces: [
        { contractAddress: selection[0].contractAddress, tokenId: selection[0].tokenId },
      ],
      refsCanonical: [
        { contractAddress: selection[0].contractAddress, tokenId: selection[0].tokenId },
      ],
      salt: "0x" + "11".repeat(32),
      animationUrl: "ipfs://cid/palette_morph.gif",
      externalUrl: "https://example.com/m/123",
      imageUrl: "ipfs://cid/gif_0001.gif",
      paletteEntry: {
        output: "palette_test.png",
        palette_id: "TEST123",
        palette_url: "https://colorhunt.co/palette/test",
        hex_colors: ["#000000", "#ffffff"],
        used_hex_colors: ["#000000", "#ffffff"],
        rarity_inverse_frequency: 0.1,
        rarity_color_rarity_sum: 1.2,
        rarity_unique_count: 2,
      },
      paletteIndex: 42,
      gif: {
        variantIndex: 1,
        selectionSeed: "0x" + "22".repeat(32),
        params: {
          rgb_sep_px: 0,
          band_shift_px: 4,
          grain_intensity: 0.15,
          contrast_flicker: 0.05,
          solarization_strength: 0.25,
        },
        lessSupplyMint: "1000",
      },
    });

    expect(metadata.external_url).toBe("https://example.com/m/123");
    expect(metadata.animation_url).toBe("ipfs://cid/palette_morph.gif");
    expect(metadata.image).toBe("ipfs://cid/gif_0001.gif");
    expect(metadata.provenance.refsCanonical?.length).toBe(1);
    const traits = metadata.attributes.map((attr) => attr.trait_type);
    expect(traits).toContain("Palette Index");
    expect(traits).toContain("Palette ID");
    expect(traits).toContain("Palette Hex Colors");
    expect(traits).toContain("Palette Used Hex Colors");
    expect(traits).toContain("Palette Rarity Inverse Frequency");
    expect(traits).toContain("Palette Rarity Color Sum");
    expect(traits).toContain("Palette Rarity Unique Count");
    const size = JSON.stringify(metadata).length;
    expect(size).toBeLessThan(50_000);
  });
});
