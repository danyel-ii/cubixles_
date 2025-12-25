export async function pinTokenMetadata(metadata) {
  const response = await fetch("/api/pin/metadata", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(metadata),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Pinning failed (${response.status})`);
  }
  const json = await response.json();
  if (!json?.uri) {
    throw new Error("Pinning failed to return a token URI.");
  }
  return json.uri;
}
