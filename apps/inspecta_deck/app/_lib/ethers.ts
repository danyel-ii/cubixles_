import { Contract, Interface, JsonRpcProvider } from "ethers";

import { getAlchemyRpcUrl, getEnvConfig } from "./env";
import { normalizeAddress, normalizeTokenId } from "./normalize";

const ERC721_ABI = [
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
];

const TRANSFER_EVENT = "Transfer";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const providers = new Map<string, JsonRpcProvider>();
let erc721Interface: Interface | null = null;

function getProviderKey(chainIdOverride?: number) {
  return chainIdOverride ? String(chainIdOverride) : "default";
}

export function getProvider(chainIdOverride?: number) {
  const key = getProviderKey(chainIdOverride);
  const cached = providers.get(key);
  if (cached) {
    return cached;
  }
  const next = new JsonRpcProvider(getAlchemyRpcUrl(chainIdOverride));
  providers.set(key, next);
  return next;
}

export function getErc721Interface() {
  if (!erc721Interface) {
    erc721Interface = new Interface(ERC721_ABI);
  }
  return erc721Interface;
}

export function getErc721Contract(chainIdOverride?: number) {
  const { contractAddress } = getEnvConfig(chainIdOverride);
  return new Contract(contractAddress, ERC721_ABI, getProvider(chainIdOverride));
}

export async function getMintedTokenIdsFromReceipt(txHash: string, chainIdOverride?: number) {
  const receipt = await getProvider(chainIdOverride).getTransactionReceipt(txHash);
  if (!receipt) {
    return [];
  }

  const { contractAddress } = getEnvConfig(chainIdOverride);
  const normalizedContract = normalizeAddress(contractAddress);
  const iface = getErc721Interface();
  const mintedTokenIds: string[] = [];

  receipt.logs.forEach((log) => {
    if (normalizeAddress(log.address) !== normalizedContract) {
      return;
    }

    try {
      const parsed = iface.parseLog({ topics: log.topics, data: log.data });
      if (!parsed || parsed.name !== TRANSFER_EVENT) {
        return;
      }

      const from = normalizeAddress(parsed.args.from as string);
      if (from !== ZERO_ADDRESS) {
        return;
      }

      const tokenIdValue = parsed.args.tokenId;
      const tokenId = normalizeTokenId(String(tokenIdValue));
      if (tokenId) {
        mintedTokenIds.push(tokenId);
      }
    } catch {
      return;
    }
  });

  return Array.from(new Set(mintedTokenIds));
}

export async function readOwnerOf(tokenId: string, chainIdOverride?: number) {
  const contract = getErc721Contract(chainIdOverride);
  return contract.ownerOf(tokenId);
}

export async function readTokenUri(tokenId: string, chainIdOverride?: number) {
  const contract = getErc721Contract(chainIdOverride);
  return contract.tokenURI(tokenId);
}
