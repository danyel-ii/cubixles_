import { solidityPackedKeccak256 } from "ethers";
import {
  RGB_SEP_PX,
  BAND_SHIFT_PX,
  GRAIN_INTENSITY,
  CONTRAST_FLICKER,
  SOLARIZATION_STRENGTH,
} from "./params.js";
import { getGifLibraryCid } from "../config/links.js";

export function computeGifSeed({ tokenId, minter }) {
  return solidityPackedKeccak256(
    ["string", "uint256", "address"],
    ["cubixles_-gif-v1", tokenId, minter]
  );
}

export function computeVariantIndex(seedHex) {
  const value = BigInt(seedHex);
  return Number(value % 1024n);
}

export function decodeVariantIndex(index) {
  let remaining = index;
  const digits = [];
  for (let i = 0; i < 5; i += 1) {
    digits.push(remaining % 4);
    remaining = Math.floor(remaining / 4);
  }
  return {
    rgb_sep_px: RGB_SEP_PX[digits[0]],
    band_shift_px: BAND_SHIFT_PX[digits[1]],
    grain_intensity: GRAIN_INTENSITY[digits[2]],
    contrast_flicker: CONTRAST_FLICKER[digits[3]],
    solarization_strength: SOLARIZATION_STRENGTH[digits[4]],
  };
}

export function gifIpfsUrl(index) {
  const cid = getGifLibraryCid();
  void index;
  return `ipfs://${cid}`;
}
