import mainnetDeployment from "../../contracts/deployments/mainnet.json";
import baseDeployment from "../../contracts/deployments/base.json";
import sepoliaDeployment from "../../contracts/deployments/sepolia.json";

const DEPLOYMENTS = new Map([
  [1, mainnetDeployment],
  [8453, baseDeployment],
  [11155111, sepoliaDeployment],
]);

export function getMinterDeployment(chainId) {
  return DEPLOYMENTS.get(chainId) || DEPLOYMENTS.get(1);
}

export function getMinterContractAddress(chainId) {
  const deployment = getMinterDeployment(chainId);
  const address = deployment?.address;
  return typeof address === "string" ? address : "0x0000000000000000000000000000000000000000";
}
