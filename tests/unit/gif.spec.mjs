import { describe, it, expect } from "vitest";
import {
  computeGifSeed,
  computeVariantIndex,
  decodeVariantIndex,
  gifIpfsUrl,
} from "../../app/_client/src/gif/variant.js";
import {
  RGB_SEP_PX,
  BAND_SHIFT_PX,
  GRAIN_INTENSITY,
  CONTRAST_FLICKER,
  SOLARIZATION_STRENGTH,
} from "../../app/_client/src/gif/params.js";

describe("gif variant mapping", () => {
  it("maps seed to stable variant and params", () => {
    const seed = computeGifSeed({
      tokenId: 123n,
      minter: "0x000000000000000000000000000000000000dEaD",
    });
    const index = computeVariantIndex(seed);
    const params = decodeVariantIndex(index);
    expect(index).toBeTypeOf("number");
    expect(params).toHaveProperty("rgb_sep_px");
    expect(params).toHaveProperty("band_shift_px");
    expect(params).toHaveProperty("grain_intensity");
    expect(params).toHaveProperty("contrast_flicker");
    expect(params).toHaveProperty("solarization_strength");
  });

  it("decodes index 0 to first param values", () => {
    const params = decodeVariantIndex(0);
    expect(params.rgb_sep_px).toBe(RGB_SEP_PX[0]);
    expect(params.band_shift_px).toBe(BAND_SHIFT_PX[0]);
    expect(params.grain_intensity).toBe(GRAIN_INTENSITY[0]);
    expect(params.contrast_flicker).toBe(CONTRAST_FLICKER[0]);
    expect(params.solarization_strength).toBe(SOLARIZATION_STRENGTH[0]);
  });

  it("builds a stable IPFS URL for the wallet GIF", () => {
    const url = gifIpfsUrl(7);
    expect(url).toBe(
      "ipfs://bafybeiap5a6tm3kpiizbjscfh5cafj245jjuchvfumz2azwyvs3y3ybvpy"
    );
  });
});
