import { Interface } from "ethers";
import { ICECUBE_CONTRACT } from "../../config/contracts";

export async function fetchTokenUri(tokenId) {
  if (!ICECUBE_CONTRACT.address || ICECUBE_CONTRACT.address === "0x0000000000000000000000000000000000000000") {
    throw new Error("Contract address not configured.");
  }
  const chainId = ICECUBE_CONTRACT.chainId;
  const iface = new Interface(ICECUBE_CONTRACT.abi);
  const data = iface.encodeFunctionData("tokenURI", [tokenId]);
  const response = await fetch("/api/nfts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "rpc",
      chainId,
      calls: [{ to: ICECUBE_CONTRACT.address, data }],
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
