import { BrowserProvider, Contract, Interface } from "ethers";
import { CUBIXLES_CONTRACT } from "../../config/contracts";

function isZeroAddress(address) {
  return !address || address === "0x0000000000000000000000000000000000000000";
}

export async function fetchLessDelta(provider, tokenId) {
  if (tokenId === null || tokenId === undefined) {
    return null;
  }
  if (isZeroAddress(CUBIXLES_CONTRACT.address) || !CUBIXLES_CONTRACT.abi?.length) {
    return null;
  }
  if (!provider) {
    return fetchLessDeltaFromRpc(tokenId);
  }
  const browserProvider = new BrowserProvider(provider);
  const network = await browserProvider.getNetwork();
  if (Number(network.chainId) !== CUBIXLES_CONTRACT.chainId) {
    return null;
  }
  const contract = new Contract(
    CUBIXLES_CONTRACT.address,
    CUBIXLES_CONTRACT.abi,
    browserProvider
  );
  const [supplyNow, deltaFromLast, deltaFromMint] = await Promise.all([
    contract.lessSupplyNow(),
    contract.deltaFromLast(tokenId),
    contract.deltaFromMint(tokenId),
  ]);
  return {
    supplyNow: BigInt(supplyNow),
    deltaFromLast: BigInt(deltaFromLast),
    deltaFromMint: BigInt(deltaFromMint),
  };
}

async function rpcCallBatch(chainId, calls) {
  const response = await fetch("/api/nfts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "rpc",
      chainId,
      calls,
    }),
  });
  if (!response.ok) {
    throw new Error(`RPC call failed (${response.status}).`);
  }
  const json = await response.json();
  if (!Array.isArray(json)) {
    throw new Error("RPC response missing results.");
  }
  return json;
}

async function fetchLessDeltaFromRpc(tokenId) {
  const iface = new Interface(CUBIXLES_CONTRACT.abi);
  const supplyData = iface.encodeFunctionData("lessSupplyNow");
  const lastData = iface.encodeFunctionData("deltaFromLast", [tokenId]);
  const mintData = iface.encodeFunctionData("deltaFromMint", [tokenId]);

  const results = await rpcCallBatch(CUBIXLES_CONTRACT.chainId, [
    { to: CUBIXLES_CONTRACT.address, data: supplyData },
    { to: CUBIXLES_CONTRACT.address, data: lastData },
    { to: CUBIXLES_CONTRACT.address, data: mintData },
  ]);
  const supplyRaw = results[0]?.result;
  const lastRaw = results[1]?.result;
  const mintRaw = results[2]?.result;
  if (!supplyRaw || !lastRaw || !mintRaw) {
    throw new Error("RPC response missing result.");
  }

  const supplyNow = iface.decodeFunctionResult("lessSupplyNow", supplyRaw)[0];
  const deltaFromLast = iface.decodeFunctionResult("deltaFromLast", lastRaw)[0];
  const deltaFromMint = iface.decodeFunctionResult("deltaFromMint", mintRaw)[0];

  return {
    supplyNow: BigInt(supplyNow),
    deltaFromLast: BigInt(deltaFromLast),
    deltaFromMint: BigInt(deltaFromMint),
  };
}
