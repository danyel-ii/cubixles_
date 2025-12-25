const TOTAL_SUPPLY_SELECTOR = "0x18160ddd";
const BALANCE_OF_SELECTOR = "0x70a08231";
import { readEnvValue } from "../../shared/utils/env.js";

const BURN_ADDRESS =
  readEnvValue("NEXT_PUBLIC_LESS_BURN_ADDRESS") ||
  "0x000000000000000000000000000000000000dEaD";

function getLessTokenAddress() {
  return (
    readEnvValue("NEXT_PUBLIC_LESS_TOKEN_ADDRESS") ||
    "0x9c2ca573009f181eac634c4d6e44a0977c24f335"
  );
}

export async function fetchLessTotalSupply() {
  const token = getLessTokenAddress();
  const payload = {
    to: "",
    data: "",
  };
  const balanceOfData = `${BALANCE_OF_SELECTOR}${BURN_ADDRESS.slice(2).padStart(64, "0")}`;
  const response = await fetch("/api/nfts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "rpc",
      chainId: 1,
      calls: [
        {
          ...payload,
          to: token,
          data: TOTAL_SUPPLY_SELECTOR,
        },
        {
          ...payload,
          to: token,
          data: balanceOfData,
        },
      ],
    }),
  });
  if (!response.ok) {
    throw new Error(`LESS supply fetch failed (${response.status}).`);
  }
  const json = await response.json();
  if (!Array.isArray(json) || json.length < 2) {
    throw new Error("LESS supply response missing results.");
  }
  const totalSupply = json[0]?.result;
  const burnBalance = json[1]?.result;
  if (!totalSupply || !burnBalance) {
    throw new Error("LESS supply response missing result.");
  }
  const supply = BigInt(totalSupply);
  const burned = BigInt(burnBalance);
  return supply > burned ? supply - burned : 0n;
}
