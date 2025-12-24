const IPFS_GATEWAY = "https://ipfs.io/ipfs/";

export function resolveUri(original: string | null | undefined): {
  original: string;
  resolved: string;
} | null {
  if (!original) {
    return null;
  }
  const trimmed = original.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.startsWith("ipfs://")) {
    return {
      original: trimmed,
      resolved: `${IPFS_GATEWAY}${trimmed.replace("ipfs://", "")}`,
    };
  }
  return {
    original: trimmed,
    resolved: trimmed,
  };
}
