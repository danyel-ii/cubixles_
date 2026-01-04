import abi from "../../../../contracts/abi/CubixlesMinter.json";
import { getActiveChainId, getChainConfig } from "./chains.js";

function getDeployment(chainId: number) {
  const chain = getChainConfig(chainId);
  return chain?.deployment;
}

export function getCubixlesContract(chainId = getActiveChainId()) {
  const deployment = getDeployment(chainId);
  return {
    chainId,
    address: deployment?.address ?? "0x0000000000000000000000000000000000000000",
    royaltySplitter: deployment?.royaltySplitter ?? null,
    abi,
  };
}

export const CUBIXLES_CONTRACT = {
  get chainId() {
    return getActiveChainId();
  },
  get address() {
    return getCubixlesContract().address;
  },
  get royaltySplitter() {
    return getCubixlesContract().royaltySplitter;
  },
  abi,
};
