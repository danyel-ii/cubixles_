const API_VERSION = "v3";

type AlchemyResponse<T> = {
  result?: T;
  [key: string]: unknown;
};

function getAlchemyBaseUrl(chainId: number, apiKey: string): string {
  if (chainId === 1) {
    return `https://eth-mainnet.g.alchemy.com/nft/${API_VERSION}/${apiKey}`;
  }
  if (chainId === 11155111) {
    return `https://eth-sepolia.g.alchemy.com/nft/${API_VERSION}/${apiKey}`;
  }
  throw new Error("Unsupported chain for Alchemy NFT API.");
}

export async function alchemyGet<T>(
  chainId: number,
  path: string,
  query: Record<string, string | number | undefined | Array<string | number>>
): Promise<T> {
  const apiKey = import.meta.env.VITE_ALCHEMY_API_KEY;
  if (!apiKey) {
    throw new Error("Missing VITE_ALCHEMY_API_KEY.");
  }
  const baseUrl = getAlchemyBaseUrl(chainId, apiKey);
  const url = new URL(`${baseUrl}/${path}`);
  Object.entries(query).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((entry) => {
        if (entry !== undefined && entry !== null) {
          url.searchParams.append(key, String(entry));
        }
      });
      return;
    }
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  });
  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Alchemy request failed (${response.status}).`);
  }
  const json = (await response.json()) as AlchemyResponse<T>;
  return (json.result ?? json) as T;
}
