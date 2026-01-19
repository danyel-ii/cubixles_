const BASE62_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const BASE = BigInt(BASE62_ALPHABET.length);

export function encodeTokenIdToBase62(tokenId: string): string | null {
  try {
    let value = BigInt(tokenId);
    if (value < 0n) {
      return null;
    }
    if (value === 0n) {
      return BASE62_ALPHABET[0];
    }
    let output = "";
    while (value > 0n) {
      const remainder = value % BASE;
      output = BASE62_ALPHABET[Number(remainder)] + output;
      value /= BASE;
    }
    return output;
  } catch {
    return null;
  }
}

export function decodeBase62ToTokenId(value: string): string | null {
  if (!value || !/^[0-9A-Za-z]+$/.test(value)) {
    return null;
  }
  let output = 0n;
  for (const char of value) {
    const index = BASE62_ALPHABET.indexOf(char);
    if (index < 0) {
      return null;
    }
    output = output * BASE + BigInt(index);
  }
  return output.toString();
}
