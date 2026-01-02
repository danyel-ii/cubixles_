import { Interface } from "ethers";
import { CUBIXLES_CONTRACT } from "../../config/contracts";

export async function fetchTokenUri(tokenId) {
  if (!CUBIXLES_CONTRACT.address || CUBIXLES_CONTRACT.address === "0x0000000000000000000000000000000000000000") {
    throw new Error("Contract address not configured.");
  }
  const chainId = CUBIXLES_CONTRACT.chainId;
  const iface = new Interface(CUBIXLES_CONTRACT.abi);
  const data = iface.encodeFunctionData("tokenURI", [tokenId]);
  const response = await fetch("/api/nfts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "rpc",
      chainId,
      calls: [{ to: CUBIXLES_CONTRACT.address, data }],
    }),
  });
  if (!response.ok) {
    throw new Error(`tokenURI fetch failed (${response.status}).`);
  }
  const json = await response.json();
  if (!Array.isArray(json) || !json[0]?.result) {
    throw new Error("tokenURI response missing result.");
  }
  const decoded = iface.decodeFunctionResult("tokenURI", json[0].result);
  return decoded?.[0] ?? null;
}
