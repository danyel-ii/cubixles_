import { solidityPackedKeccak256 } from "ethers";
import { fetchWithGateways } from "../../../../../src/shared/ipfs-fetch.js";
import { getPaletteImagesCid, getPaletteManifestCid } from "../../config/links.js";

let manifestCache = null;
let manifestPromise = null;

export function computePaletteSeed({ tokenId, minter }) {
  return solidityPackedKeccak256(
    ["string", "uint256", "address"],
    ["cubixles-palette-v1", tokenId, minter]
  );
}

export function computePaletteCommitSeed({
  refsHash,
  salt,
  minter,
  commitBlockNumber,
  commitBlockHash,
}) {
  return solidityPackedKeccak256(
    ["bytes32", "bytes32", "address", "uint256", "bytes32"],
    [refsHash, salt, minter, commitBlockNumber, commitBlockHash]
  );
}

export async function loadPaletteManifest() {
  if (manifestCache) {
    return manifestCache;
  }
  if (manifestPromise) {
    return manifestPromise;
  }
  const manifestCid = getPaletteManifestCid();
  if (!manifestCid) {
    throw new Error("Palette manifest CID is not configured.");
  }
  manifestPromise = (async () => {
    const ipfsUrl = `ipfs://${manifestCid}`;
    const { response } = await fetchWithGateways(ipfsUrl, {
      timeoutMs: 12000,
      expectsJson: true,
    });
    if (!response.ok) {
      throw new Error(`Palette manifest fetch failed (${response.status}).`);
    }
    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error("Palette manifest is empty or invalid.");
    }
    manifestCache = data;
    return data;
  })();
  return manifestPromise;
}

export function pickPaletteEntry(seedHex, manifest) {
  const length = manifest.length;
  if (!length) {
    throw new Error("Palette manifest is empty.");
  }
  const value = BigInt(seedHex);
  const index = Number(value % BigInt(length));
  return { index, entry: manifest[index] };
}

export function getPaletteEntryByIndex(index, manifest) {
  if (!Array.isArray(manifest) || manifest.length === 0) {
    throw new Error("Palette manifest is empty.");
  }
  const parsed = Number(index);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed >= manifest.length) {
    throw new Error("Palette index is out of range.");
  }
  return manifest[parsed];
}

export function buildPaletteImagePath(entry) {
  if (!entry?.output) {
    return "";
  }
  const raw = entry.output.trim();
  if (!raw) {
    return "";
  }
  if (raw.includes("/")) {
    return raw;
  }
  return `cubixles_images/${raw}`;
}

export function buildPaletteImageUrl(entry) {
  const imagesCid = getPaletteImagesCid();
  const imagePath = buildPaletteImagePath(entry);
  if (!imagesCid) {
    return "";
  }
  if (!imagePath) {
    return "";
  }
  return `ipfs://${imagesCid}/${imagePath}`;
}
