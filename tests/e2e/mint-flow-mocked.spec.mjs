import { test, expect } from "@playwright/test";
import { AbiCoder, id } from "ethers";

const coder = new AbiCoder();

function buildEthereumMock() {
  const selectors = {
    currentMintPrice: id("currentMintPrice()").slice(0, 10),
    previewTokenId: id("previewTokenId(bytes32,(address,uint256)[])").slice(0, 10),
    previewPaletteIndex: id("previewPaletteIndex(address)").slice(0, 10),
    lessSupplyNow: id("lessSupplyNow()").slice(0, 10),
    mintCommitByMinter: id("mintCommitByMinter(address)").slice(0, 10),
    commitMint: id("commitMint(bytes32)").slice(0, 10),
    commitMetadata: id("commitMetadata(bytes32,bytes32)").slice(0, 10),
    commitFeeWei: id("commitFeeWei()").slice(0, 10),
    mint: id("mint(bytes32,(address,uint256)[],uint256,string,bytes32,bytes32)").slice(0, 10),
  };
  const responses = {
    currentMintPrice: coder.encode(["uint256"], [1_500_000_000_000_000n]),
    previewTokenId: coder.encode(["uint256"], [123n]),
    previewPaletteIndex: coder.encode(["uint256"], [7n]),
    lessSupplyNow: coder.encode(["uint256"], [900_000_000n * 1_000_000_000_000_000_000n]),
    commitFeeWei: coder.encode(["uint256"], [0n]),
    mintedTokenId: coder.encode(["uint256"], [123n]),
  };
  return { selectors, responses };
}

test("mint flow reaches tx submission with mocked APIs", async ({ page }) => {
  const { selectors, responses } = buildEthereumMock();

  await page.addInitScript(() => {
    const apply = () => {
      const style = document.createElement("style");
      style.id = "__pw-disable-animations__";
      style.textContent = `
        *, *::before, *::after {
          animation: none !important;
          transition: none !important;
          scroll-behavior: auto !important;
        }
        .ui-button:hover {
          transform: none !important;
          box-shadow: none !important;
        }
      `;
      const parent = document.head || document.documentElement;
      if (parent) {
        parent.appendChild(style);
      }
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", apply, { once: true });
    } else {
      apply();
    }
  });

  await page.addInitScript(({ selectors, responses }) => {
    window.__CUBIXLES_TEST_HOOKS__ = true;
    window.localStorage?.setItem("cubixles:chainId", "1");
    let commitCreated = false;
    let commitHash = "0x" + "00".repeat(32);
    const mockBlock = {
      number: "0x1",
      hash: "0x" + "11".repeat(32),
      parentHash: "0x" + "22".repeat(32),
      nonce: "0x0000000000000000",
      sha3Uncles: "0x" + "33".repeat(32),
      logsBloom: "0x" + "00".repeat(256),
      transactionsRoot: "0x" + "44".repeat(32),
      stateRoot: "0x" + "55".repeat(32),
      receiptsRoot: "0x" + "66".repeat(32),
      miner: "0x0000000000000000000000000000000000000000",
      difficulty: "0x0",
      totalDifficulty: "0x0",
      extraData: "0x",
      size: "0x1",
      gasLimit: "0x1c9c380",
      gasUsed: "0x0",
      timestamp: "0x0",
      transactions: [],
      uncles: [],
      baseFeePerGas: "0x0",
      mixHash: "0x" + "77".repeat(32),
    };
    const pad32 = (hex) => hex.replace(/^0x/, "").padStart(64, "0");
    const encodeUint = (value) => pad32(BigInt(value).toString(16));
    const encodeBool = (value) => pad32(value ? "1" : "0");
    const encodeCommit = () => {
      if (!commitCreated) {
        return (
          "0x" +
          [
            pad32("0x0"),
            encodeUint(0),
            encodeUint(0),
            encodeUint(0),
            encodeBool(false),
            encodeUint(0),
            encodeBool(false),
            pad32("0x0"),
            pad32("0x0"),
            encodeBool(false),
            encodeUint(0),
          ].join("")
        );
      }
      return (
        "0x" +
        [
          pad32(commitHash),
          encodeUint(2),
          encodeUint(1),
          encodeUint(42),
          encodeBool(true),
          encodeUint(7),
          encodeBool(true),
          pad32("0x0"),
          pad32("0x0"),
          encodeBool(false),
          encodeUint(0),
        ].join("")
      );
    };

    window.ethereum = {
      request: async ({ method, params }) => {
        if (method === "eth_chainId") {
          return "0x1";
        }
        if (method === "wallet_switchEthereumChain" || method === "wallet_addEthereumChain") {
          return null;
        }
        if (method === "eth_requestAccounts" || method === "eth_accounts") {
          return ["0x000000000000000000000000000000000000dEaD"];
        }
        if (method === "eth_call") {
          const data = params?.[0]?.data || "";
          if (data.startsWith(selectors.currentMintPrice)) {
            return responses.currentMintPrice;
          }
          if (data.startsWith(selectors.commitFeeWei)) {
            return responses.commitFeeWei;
          }
          if (data.startsWith(selectors.previewTokenId)) {
            return responses.previewTokenId;
          }
          if (data.startsWith(selectors.previewPaletteIndex)) {
            return responses.previewPaletteIndex;
          }
          if (data.startsWith(selectors.lessSupplyNow)) {
            return responses.lessSupplyNow;
          }
          if (data.startsWith(selectors.mintCommitByMinter)) {
            return encodeCommit();
          }
          if (data.startsWith(selectors.commitMint)) {
            return "0x";
          }
          if (data.startsWith(selectors.commitMetadata)) {
            return "0x";
          }
          if (data.startsWith(selectors.mint)) {
            return responses.mintedTokenId;
          }
          return responses.currentMintPrice;
        }
        if (method === "eth_estimateGas") {
          return "0x5208";
        }
        if (method === "eth_gasPrice") {
          return "0x3b9aca00";
        }
        if (method === "eth_maxPriorityFeePerGas") {
          return "0x3b9aca00";
        }
        if (method === "eth_getBalance") {
          return "0x3635C9ADC5DEA00000";
        }
        if (method === "eth_getTransactionCount") {
          return "0x1";
        }
        if (method === "eth_sendTransaction") {
          const data = params?.[0]?.data || "";
          if (data.startsWith(selectors.commitMint)) {
            commitHash = `0x${data.slice(10, 74)}`;
            commitCreated = true;
          }
          return "0xdeadbeef";
        }
        if (method === "eth_getTransactionReceipt") {
          return {
            status: "0x1",
            transactionHash: "0xdeadbeef",
            blockNumber: "0x2",
            logs: [],
          };
        }
        if (method === "eth_getBlockByNumber") {
          return mockBlock;
        }
        if (method === "eth_blockNumber") {
          return "0x1";
        }
        return null;
      },
      on: () => {},
      removeListener: () => {},
    };
  }, { selectors, responses });

  await page.route("**/api/nonce", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ nonce: "nonce123" }),
    });
  });

  await page.route("**/api/pin/metadata", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        tokenURI: "ipfs://cid123",
        metadataHash: "0x" + "aa".repeat(32),
      }),
    });
  });

  await page.route("**/api/ipfs**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([{ output: "palette.png" }]),
    });
  });

  await page.route("**/api/nfts", async (route) => {
    const body = route.request().postDataJSON() || {};
    if (body?.mode === "rpc") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          { result: "0x0" },
          { result: "0x0" },
        ]),
      });
      return;
    }
    if (body?.path === "getNFTMetadata") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          contract: { address: body?.query?.contractAddress },
          tokenId: body?.query?.tokenId,
          tokenType: "ERC721",
          name: "Mock NFT",
          tokenUri: { raw: "ipfs://token" },
          collection: { name: "Mock Collection" },
          image: { cachedUrl: "https://example.com/nft.png", originalUrl: "https://example.com/nft.png" },
          metadata: { name: "Mock NFT" },
          raw: { metadata: { name: "Mock NFT" } },
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ownedNfts: [
          {
            contract: { address: "0x000000000000000000000000000000000000dEaD" },
            tokenId: "1",
            tokenType: "ERC721",
            name: "Mock NFT",
            collection: { name: "Mock Collection" },
            tokenUri: { raw: "ipfs://token" },
            image: { cachedUrl: "https://example.com/nft.png", originalUrl: "https://example.com/nft.png" },
            metadata: { name: "Mock NFT" },
            raw: { metadata: { name: "Mock NFT" } },
          },
        ],
      }),
    });
  });

  await page.goto("/?skipIntro=1");
  await page.waitForFunction(() => window.__CUBIXLES_MAIN_IMPORTED__ === true);
  await page.waitForFunction(
    () => typeof window.__CUBIXLES_WALLET__?.connectWallet === "function"
  );
  await page.waitForSelector("#overlay");
  await page.evaluate(() => {
    document.getElementById("overlay")?.classList.add("is-hidden");
    document.body.classList.remove("overlay-active");
  });
  await page.evaluate(async () => {
    await window.__CUBIXLES_WALLET__?.connectWallet?.();
  });
  await expect(page.locator("#wallet-status")).toContainText(/connected/i, {
    timeout: 10000,
  });
  const nftCard = page.locator(".nft-card").first();
  await expect(nftCard).toBeVisible({ timeout: 10000 });
  await nftCard.click();
  await expect(page.locator("#nft-selection")).toContainText(/Selected 1 \/ 6/i, {
    timeout: 10000,
  });
  await expect(page.locator("#mint-status")).toContainText(/Ready to mint/i, {
    timeout: 10000,
  });
  const mintButton = page.getByRole("button", { name: /mint nft/i });
  await expect(mintButton).toBeVisible({ timeout: 10000 });
  await expect(mintButton).toBeEnabled({ timeout: 10000 });
  // Avoid Playwright actionability instability in CI from animated layout shifts.
  await mintButton.evaluate((button) => button.click());

  await expect(page.locator("#mint-status")).toContainText(
    /step 1\/3: confirm commit|step 2\/3: confirm metadata|step 3\/3: confirm mint|pinning metadata|waiting for randomness|waiting for metadata confirmation|submitting mint transaction|waiting for confirmation|mint confirmed|preparing mint steps|preparing mint/i,
    {
      timeout: 5000,
    }
  );
});
