import { ICECUBE_CONTRACT } from "../config/contracts";

export function initLeaderboardUi() {
  const openButton = document.getElementById("leaderboard-open");
  const backButton = document.getElementById("leaderboard-back");
  const mainPanel = document.getElementById("ui");
  const leaderboardPanel = document.getElementById("leaderboard");
  const contractEl = document.getElementById("leaderboard-contract");
  const chainEl = document.getElementById("leaderboard-chain");
  const updatedEl = document.getElementById("leaderboard-updated");

  if (
    !openButton ||
    !backButton ||
    !mainPanel ||
    !leaderboardPanel ||
    !contractEl ||
    !chainEl ||
    !updatedEl
  ) {
    return;
  }

  function formatChain(chainId) {
    if (chainId === 11155111) {
      return "Sepolia";
    }
    if (chainId === 1) {
      return "Ethereum Mainnet";
    }
    return `Chain ${chainId}`;
  }

  function updateLeaderboardDetails() {
    contractEl.textContent = `Contract: ${ICECUBE_CONTRACT.address}`;
    chainEl.textContent = `Chain: ${formatChain(ICECUBE_CONTRACT.chainId)}`;
    updatedEl.textContent = `Last updated: ${new Date().toISOString()}`;
  }

  function showLeaderboard() {
    updateLeaderboardDetails();
    mainPanel.classList.add("is-hidden");
    leaderboardPanel.classList.remove("is-hidden");
  }

  function showMain() {
    leaderboardPanel.classList.add("is-hidden");
    mainPanel.classList.remove("is-hidden");
  }

  openButton.addEventListener("click", showLeaderboard);
  backButton.addEventListener("click", showMain);
}
