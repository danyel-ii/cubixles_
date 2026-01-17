import abi from "../../../../contracts/abi/CubixlesBuilderMinter.json";
import { getActiveChainId } from "./chains.js";
import mainnetDeployment from "../../../../contracts/deployments/builder-mainnet.json";
import baseDeployment from "../../../../contracts/deployments/builder-base.json";
import sepoliaDeployment from "../../../../contracts/deployments/builder-sepolia.json";

function getDeployment(chainId: number) {
  if (chainId === 1) {
    return mainnetDeployment;
  }
  if (chainId === 8453) {
    return baseDeployment;
  }
  if (chainId === 11155111) {
    return sepoliaDeployment;
  }
  return mainnetDeployment;
}

export function getBuilderContract(chainId = getActiveChainId()) {
  const deployment = getDeployment(chainId);
  return {
    chainId,
    address: deployment?.address ?? "0x0000000000000000000000000000000000000000",
    abi,
  };
}

export const BUILDER_CONTRACT = {
  get chainId() {
    return getActiveChainId();
  },
  get address() {
    return getBuilderContract().address;
  },
  abi,
};
