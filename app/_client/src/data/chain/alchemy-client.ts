export async function alchemyGet<T>(
  chainId: number,
  path: string,
  query: Record<string, string | number | undefined | Array<string | number>>
): Promise<T> {
  const response = await fetch("/api/nfts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "alchemy",
      chainId,
      path,
      query,
    }),
  });
  if (!response.ok) {
    throw new Error(`API request failed (${response.status}).`);
  }
  const json = (await response.json()) as T;
  return json;
}
