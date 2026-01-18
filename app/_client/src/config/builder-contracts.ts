import { getActiveChainId } from "./chains.js";
import mainnetDeployment from "../../../../contracts/deployments/builder-mainnet.json";
import baseDeployment from "../../../../contracts/deployments/builder-base.json";
import sepoliaDeployment from "../../../../contracts/deployments/builder-sepolia.json";

const abi = [
  "function mintBuilders((address contractAddress,uint256 tokenId)[] refs,uint256[] floorsWei,(uint256 totalFloorWei,uint256 chainId,uint256 expiresAt,uint256 nonce) quote,bytes signature) payable returns (uint256)",
  "function mintBuildersWithMetadata((address contractAddress,uint256 tokenId)[] refs,uint256[] floorsWei,(uint256 totalFloorWei,uint256 chainId,uint256 expiresAt,uint256 nonce) quote,bytes signature,string tokenUri,bytes32 metadataHash,uint256 expectedTokenId) payable returns (uint256)",
  "function mintPriceByTokenId(uint256) view returns (uint256)",
  "function nextTokenId() view returns (uint256)",
  "function ownerOf(uint256) view returns (address)",
  "function totalMinted() view returns (uint256)",
];

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
