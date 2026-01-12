import { Interface } from "ethers";
import { CUBIXLES_CONTRACT, getCubixlesContract } from "../../config/contracts";
import { postNftsApi } from "./nfts-api.js";

export async function fetchTokenUri(tokenId, chainIdOverride) {
  const contract = chainIdOverride
    ? getCubixlesContract(chainIdOverride)
    : CUBIXLES_CONTRACT;
  if (!contract.address || contract.address === "0x0000000000000000000000000000000000000000") {
    throw new Error("Contract address not configured.");
  }
  const chainId = contract.chainId;
  const iface = new Interface(contract.abi);
  const data = iface.encodeFunctionData("tokenURI", [tokenId]);
  const json = await postNftsApi(
    {
      mode: "rpc",
      chainId,
      calls: [{ to: contract.address, data }],
    },
    { errorLabel: "tokenURI fetch failed" }
  );
  if (!Array.isArray(json) || !json[0]?.result) {
    throw new Error("tokenURI response missing result.");
  }
  const decoded = iface.decodeFunctionResult("tokenURI", json[0].result);
  return decoded?.[0] ?? null;
}

export async function fetchMintPriceByTokenId(tokenId, chainIdOverride) {
  const contract = chainIdOverride
    ? getCubixlesContract(chainIdOverride)
    : CUBIXLES_CONTRACT;
  if (!contract.address || contract.address === "0x0000000000000000000000000000000000000000") {
    throw new Error("Contract address not configured.");
  }
  const chainId = contract.chainId;
  const iface = new Interface(contract.abi);
  const data = iface.encodeFunctionData("mintPriceByTokenId", [tokenId]);
  const json = await postNftsApi(
    {
      mode: "rpc",
      chainId,
      calls: [{ to: contract.address, data }],
    },
    { errorLabel: "mint price fetch failed" }
  );
  if (!Array.isArray(json) || !json[0]?.result) {
    throw new Error("mintPriceByTokenId response missing result.");
  }
  const decoded = iface.decodeFunctionResult("mintPriceByTokenId", json[0].result);
  return decoded?.[0] ?? null;
}
