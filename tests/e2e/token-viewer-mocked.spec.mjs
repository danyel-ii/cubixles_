import { test, expect } from "@playwright/test";
import { AbiCoder } from "ethers";

const coder = new AbiCoder();

test("token viewer loads metadata and refs without crashing", async ({ page }) => {
  const tokenUriResponse = coder.encode(["string"], ["ipfs://cid/meta.json"]);

  await page.addInitScript(() => {
    window.__CUBIXLES_SKIP_FROSTED__ = true;
    window.loadImage = (url, onLoad) => {
      const img = { width: 100, height: 100, resize: () => {} };
      onLoad(img);
    };
  });

  await page.route("**/api/nfts", async (route) => {
    const body = route.request().postDataJSON() || {};
    if (body?.mode === "rpc") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{ result: tokenUriResponse }]),
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
      body: JSON.stringify({ ownedNfts: [] }),
    });
  });

  await page.route("**/ipfs/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        name: "cubixles_ #123",
        provenance: {
          refs: [
            {
              contractAddress: "0x000000000000000000000000000000000000dEaD",
              tokenId: "1",
            },
          ],
        },
      }),
    });
  });

  await page.goto("/m/123");
  await expect(page.locator("#token-view-status")).toContainText(/loaded|loading/i, {
    timeout: 5000,
  });
});
