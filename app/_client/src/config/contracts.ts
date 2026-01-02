import deployment from "../../../../contracts/deployments/mainnet.json";
import abi from "../../../../contracts/abi/CubixlesMinter.json";

export const CUBIXLES_CONTRACT = {
  chainId: deployment.chainId,
  address: deployment.address,
  abi,
};
