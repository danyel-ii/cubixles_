import { alchemyGet } from "../alchemy/client";

const MAINNET_CHAIN_ID = 1;

function extractFloorValue(payload) {
  if (!payload || typeof payload !== "object") {
    return 0;
  }
  if (typeof payload.floorPrice === "number") {
    return payload.floorPrice;
  }
  const values = Object.values(payload);
  const floors = values
    .map((entry) => (entry && typeof entry === "object" ? entry.floorPrice : null))
    .filter((value) => typeof value === "number");
  if (!floors.length) {
    return 0;
  }
  return Math.max(...floors);
}

function extractRetrievedAt(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const candidates = [];
  if (typeof payload.retrievedAt === "string") {
    candidates.push(payload.retrievedAt);
  }
  if (typeof payload.lastUpdated === "string") {
    candidates.push(payload.lastUpdated);
  }
  if (typeof payload.updatedAt === "string") {
    candidates.push(payload.updatedAt);
  }
  const values = Object.values(payload);
  values.forEach((entry) => {
    if (entry && typeof entry === "object") {
      if (typeof entry.retrievedAt === "string") {
        candidates.push(entry.retrievedAt);
      }
      if (typeof entry.lastUpdated === "string") {
        candidates.push(entry.lastUpdated);
      }
      if (typeof entry.updatedAt === "string") {
        candidates.push(entry.updatedAt);
      }
    }
  });
  if (!candidates.length) {
    return null;
  }
  return candidates[0];
}

export async function getCollectionFloorSnapshot(contractAddress, chainId) {
  if (chainId !== MAINNET_CHAIN_ID) {
    return { floorEth: 0, retrievedAt: null };
  }
  try {
    const response = await alchemyGet(chainId, "getFloorPrice", {
      contractAddress,
    });
    return {
      floorEth: extractFloorValue(response),
      retrievedAt: extractRetrievedAt(response) ?? new Date().toISOString(),
    };
  } catch (error) {
    console.warn("Floor price unavailable:", error);
    return { floorEth: 0, retrievedAt: null };
  }
}
