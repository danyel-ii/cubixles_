export function normalizeAddress(address?: string | null): string | null {
  if (!address) {
    return null;
  }
  return address.trim().toLowerCase();
}

export function normalizeTokenId(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    if (trimmed.startsWith("0x") || trimmed.startsWith("0X")) {
      return BigInt(trimmed).toString(10);
    }
    return BigInt(trimmed).toString(10);
  } catch {
    return trimmed;
  }
}
