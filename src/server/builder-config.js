import mainnetDeployment from "../../contracts/deployments/builder-mainnet.json";
import baseDeployment from "../../contracts/deployments/builder-base.json";
import sepoliaDeployment from "../../contracts/deployments/builder-sepolia.json";

const DEPLOYMENTS = new Map([
  [1, mainnetDeployment],
  [8453, baseDeployment],
  [11155111, sepoliaDeployment],
]);

export function getBuilderDeployment(chainId) {
  return DEPLOYMENTS.get(chainId) || DEPLOYMENTS.get(1);
}

export function getBuilderContractAddress(chainId) {
  const deployment = getBuilderDeployment(chainId);
  const address = deployment?.address;
  return typeof address === "string" ? address : "0x0000000000000000000000000000000000000000";
}
