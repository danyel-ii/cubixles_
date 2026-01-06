import { Interface } from "ethers";
import { CUBIXLES_CONTRACT } from "../../config/contracts";
import { postNftsApi } from "./nfts-api.js";

export async function fetchTokenUri(tokenId) {
  if (!CUBIXLES_CONTRACT.address || CUBIXLES_CONTRACT.address === "0x0000000000000000000000000000000000000000") {
    throw new Error("Contract address not configured.");
  }
  const chainId = CUBIXLES_CONTRACT.chainId;
  const iface = new Interface(CUBIXLES_CONTRACT.abi);
  const data = iface.encodeFunctionData("tokenURI", [tokenId]);
  const json = await postNftsApi(
    {
      mode: "rpc",
      chainId,
      calls: [{ to: CUBIXLES_CONTRACT.address, data }],
    },
    { errorLabel: "tokenURI fetch failed" }
  );
  if (!Array.isArray(json) || !json[0]?.result) {
    throw new Error("tokenURI response missing result.");
  }
  const decoded = iface.decodeFunctionResult("tokenURI", json[0].result);
  return decoded?.[0] ?? null;
}

export async function fetchMintPriceByTokenId(tokenId) {
  if (!CUBIXLES_CONTRACT.address || CUBIXLES_CONTRACT.address === "0x0000000000000000000000000000000000000000") {
    throw new Error("Contract address not configured.");
  }
  const chainId = CUBIXLES_CONTRACT.chainId;
  const iface = new Interface(CUBIXLES_CONTRACT.abi);
  const data = iface.encodeFunctionData("mintPriceByTokenId", [tokenId]);
  const json = await postNftsApi(
    {
      mode: "rpc",
      chainId,
      calls: [{ to: CUBIXLES_CONTRACT.address, data }],
    },
    { errorLabel: "mint price fetch failed" }
  );
  if (!Array.isArray(json) || !json[0]?.result) {
    throw new Error("mintPriceByTokenId response missing result.");
  }
  const decoded = iface.decodeFunctionResult("mintPriceByTokenId", json[0].result);
  return decoded?.[0] ?? null;
}
