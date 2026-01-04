import { test, expect } from "@playwright/test";
import { AbiCoder, id } from "ethers";

const coder = new AbiCoder();

function buildEthereumMock() {
  const selectors = {
    currentMintPrice: id("currentMintPrice()").slice(0, 10),
    previewTokenId: id("previewTokenId(bytes32,(address,uint256)[])").slice(0, 10),
    lessSupplyNow: id("lessSupplyNow()").slice(0, 10),
  };
  const responses = {
    currentMintPrice: coder.encode(["uint256"], [1_500_000_000_000_000n]),
    previewTokenId: coder.encode(["uint256"], [123n]),
    lessSupplyNow: coder.encode(["uint256"], [900_000_000n * 1_000_000_000_000_000_000n]),
  };
  return { selectors, responses };
}

test("mint flow reaches tx submission with mocked APIs", async ({ page }) => {
  const { selectors, responses } = buildEthereumMock();

  await page.addInitScript(({ selectors, responses }) => {
    window.__CUBIXLES_TEST_HOOKS__ = true;
    window.localStorage?.setItem("cubixles:chainId", "1");
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
    window.ethereum = {
      request: async ({ method, params }) => {
        if (method === "eth_chainId") {
          return "0x1";
        }
        if (method === "eth_requestAccounts" || method === "eth_accounts") {
          return ["0x000000000000000000000000000000000000dEaD"];
        }
        if (method === "eth_call") {
          const data = params?.[0]?.data || "";
          if (data.startsWith(selectors.currentMintPrice)) {
            return responses.currentMintPrice;
          }
          if (data.startsWith(selectors.previewTokenId)) {
            return responses.previewTokenId;
          }
          if (data.startsWith(selectors.lessSupplyNow)) {
            return responses.lessSupplyNow;
          }
          return responses.currentMintPrice;
        }
        if (method === "eth_estimateGas") {
          return "0x5208";
        }
        if (method === "eth_gasPrice") {
          return "0x3b9aca00";
        }
        if (method === "eth_getTransactionCount") {
          return "0x1";
        }
        if (method === "eth_sendTransaction") {
          return "0xdeadbeef";
        }
        if (method === "eth_getTransactionReceipt") {
          return {
            status: "0x1",
            transactionHash: "0xdeadbeef",
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
      body: JSON.stringify({ tokenURI: "ipfs://cid123" }),
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

  await page.goto("/");
  await page.waitForFunction(() => window.__CUBIXLES_UI_READY__ === true);
  await page.waitForSelector("#overlay");
  await page.evaluate(() => {
    document.getElementById("overlay")?.classList.add("is-hidden");
  });
  await page.evaluate(async () => {
    await window.__CUBIXLES_WALLET__?.connectWallet?.();
  });
  const refreshButton = page.getByRole("button", { name: /refresh nfts/i });
  await expect(refreshButton).toBeEnabled({ timeout: 5000 });
  await refreshButton.click();
  await page.waitForTimeout(100);
  await page.locator(".nft-card").first().click();
  await page.getByRole("button", { name: /mint nft/i }).click();

  await expect(page.locator("#mint-status")).toContainText(
    /step 1\/2: confirm commit|step 2\/2: confirm mint|submitting mint transaction|waiting for confirmation|mint confirmed/i,
    {
      timeout: 5000,
    }
  );
});
