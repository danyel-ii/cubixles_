const TOTAL_SUPPLY_SELECTOR = "0x18160ddd";
const BALANCE_OF_SELECTOR = "0x70a08231";
const BURN_ADDRESS = "0x000000000000000000000000000000000000dEaD";

function getAlchemyRpcUrl() {
  const apiKey = import.meta.env.VITE_ALCHEMY_API_KEY;
  if (!apiKey) {
    throw new Error("Missing VITE_ALCHEMY_API_KEY.");
  }
  return `https://eth-mainnet.g.alchemy.com/v2/${apiKey}`;
}

function getLessTokenAddress() {
  return (
    import.meta.env.VITE_LESS_TOKEN_ADDRESS ||
    "0x9c2ca573009f181eac634c4d6e44a0977c24f335"
  );
}

export async function fetchLessTotalSupply() {
  const url = getAlchemyRpcUrl();
  const token = getLessTokenAddress();
  const payload = {
    jsonrpc: "2.0",
    id: 1,
    method: "eth_call",
    params: [],
  };
  const balanceOfData = `${BALANCE_OF_SELECTOR}${BURN_ADDRESS.slice(2).padStart(64, "0")}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify([
      {
        ...payload,
        params: [{ to: token, data: TOTAL_SUPPLY_SELECTOR }, "latest"],
        id: 1,
      },
      {
        ...payload,
        params: [{ to: token, data: balanceOfData }, "latest"],
        id: 2,
      },
    ]),
  });
  if (!response.ok) {
    throw new Error(`LESS supply fetch failed (${response.status}).`);
  }
  const json = await response.json();
  if (!Array.isArray(json) || json.length < 2) {
    throw new Error("LESS supply response missing results.");
  }
  const totalSupply = json.find((item) => item?.id === 1)?.result;
  const burnBalance = json.find((item) => item?.id === 2)?.result;
  if (!totalSupply || !burnBalance) {
    throw new Error("LESS supply response missing result.");
  }
  const supply = BigInt(totalSupply);
  const burned = BigInt(burnBalance);
  return supply > burned ? supply - burned : 0n;
}
