const PUBLIC_ENV = {
  NEXT_PUBLIC_GIF_LIBRARY_CID: process.env.NEXT_PUBLIC_GIF_LIBRARY_CID,
  NEXT_PUBLIC_PALETTE_IMAGES_CID: process.env.NEXT_PUBLIC_PALETTE_IMAGES_CID,
  NEXT_PUBLIC_PALETTE_MANIFEST_CID: process.env.NEXT_PUBLIC_PALETTE_MANIFEST_CID,
  NEXT_PUBLIC_ANIMATION_URL: process.env.NEXT_PUBLIC_ANIMATION_URL,
  NEXT_PUBLIC_TOKEN_VIEW_BASE_URL: process.env.NEXT_PUBLIC_TOKEN_VIEW_BASE_URL,
  NEXT_PUBLIC_LESS_BURN_ADDRESS: process.env.NEXT_PUBLIC_LESS_BURN_ADDRESS,
  NEXT_PUBLIC_LESS_TOKEN_ADDRESS: process.env.NEXT_PUBLIC_LESS_TOKEN_ADDRESS,
  NEXT_PUBLIC_DEFAULT_CHAIN_ID: process.env.NEXT_PUBLIC_DEFAULT_CHAIN_ID,
  NEXT_PUBLIC_MAINNET_RPC_URL: process.env.NEXT_PUBLIC_MAINNET_RPC_URL,
  NEXT_PUBLIC_BASE_RPC_URL: process.env.NEXT_PUBLIC_BASE_RPC_URL,
  NEXT_PUBLIC_SEPOLIA_RPC_URL: process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL,
  NEXT_PUBLIC_IPFS_GATEWAY: process.env.NEXT_PUBLIC_IPFS_GATEWAY,
};

export function readEnvValue(key) {
  if (typeof process === "undefined") {
    return null;
  }
  const raw = Object.prototype.hasOwnProperty.call(PUBLIC_ENV, key)
    ? PUBLIC_ENV[key]
    : process.env[key];
  if (typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim();
  return trimmed ? trimmed : null;
}
