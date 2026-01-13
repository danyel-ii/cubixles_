import { describe, it, expect, vi, beforeEach } from "vitest";

const mockNfts = Array.from({ length: 7 }, (_, idx) => ({
  chainId: 11155111,
  contractAddress: "0x000000000000000000000000000000000000dEaD",
  tokenId: String(idx + 1),
  name: `NFT ${idx + 1}`,
  collectionName: "Test Collection",
  tokenUri: { original: "ipfs://token", resolved: "https://ipfs.io/ipfs/token" },
  image: { original: "ipfs://img", resolved: "https://ipfs.io/ipfs/img" },
  metadataAvailable: true,
  source: "alchemy",
}));

vi.mock("../../app/_client/src/data/nft/indexer", () => ({
  getNftsForOwner: vi.fn(async () => mockNfts),
}));

vi.mock("../../app/_client/src/features/wallet/wallet.js", () => ({
  subscribeWallet: (listener) => {
    listener({ status: "connected", address: "0x000000000000000000000000000000000000dEaD" });
    return () => {};
  },
}));

vi.mock("../../app/_client/src/app/app-utils.js", () => ({
  fillFaceTextures: vi.fn(),
  mapSelectionToFaceTextures: vi.fn(() => []),
  downscaleImageToMax: vi.fn((img) => img),
  getMaxTextureSize: vi.fn(() => 1024),
}));

import { initNftPickerUi } from "../../app/_client/src/features/nft/picker-ui.js";

function buildDom() {
  document.body.innerHTML = `
    <div id="nft-status"></div>
    <div id="nft-selection"></div>
    <div id="nft-grid"></div>
    <button id="nft-refresh"></button>
    <button id="nft-clear"></button>
    <button id="nft-apply"></button>
  `;
}

async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("NFT picker UI", () => {
  beforeEach(() => {
    buildDom();
  });

  it("renders inventory and enforces selection limit", async () => {
    initNftPickerUi();
    await flush();

    let cards = [...document.querySelectorAll(".nft-card")];
    expect(cards.length).toBe(7);

    cards.slice(0, 6).forEach((card) => card.click());
    await flush();
    expect(document.getElementById("nft-selection").textContent).toContain("Selected 6 / 6");

    cards = [...document.querySelectorAll(".nft-card")];
    const seventh = cards[6];
    expect(seventh.disabled).toBe(true);
  });
});
