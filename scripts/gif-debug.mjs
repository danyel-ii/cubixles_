import {
  computeGifSeed,
  computeVariantIndex,
  decodeVariantIndex,
  gifIpfsUrl,
} from "../app/_client/src/gif/variant.js";

const input = {
  tokenId: 1n,
  minter: "0x0000000000000000000000000000000000000001",
  lessSupplyMint: 0n,
};

const seed = computeGifSeed(input);
const index = computeVariantIndex(seed);
const params = decodeVariantIndex(index);
const url = gifIpfsUrl(index);

console.log("seed:", seed);
console.log("index:", index);
console.log("params:", params);
console.log("gif:", url);
