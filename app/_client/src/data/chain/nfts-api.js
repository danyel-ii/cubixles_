export async function postNftsApi(payload, { errorLabel = "API request failed", signal } = {}) {
  const response = await fetch("/api/nfts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });
  if (!response.ok) {
    let detail = "";
    try {
      const json = await response.json();
      if (json?.error) {
        detail = json.error;
      } else if (json?.message) {
        detail = json.message;
      }
      if (json?.requestId) {
        detail = detail ? `${detail} (request ${json.requestId})` : `request ${json.requestId}`;
      }
    } catch (error) {
      void error;
    }
    const suffix = detail ? `: ${detail}` : "";
    throw new Error(`${errorLabel} (${response.status})${suffix}.`);
  }
  return response.json();
}
