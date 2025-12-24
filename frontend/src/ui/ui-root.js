import { initOverlay } from "./overlay.js";
import { initLocalTextureUi } from "./local-textures.js";
import { initExportUi } from "./export-ui.js";
import { initLeaderboardUi } from "./leaderboard.js";
import { initWalletUi } from "../features/wallet/wallet-ui.js";
import { initNftPickerUi } from "../features/nft/picker-ui.js";
import { initMintUi } from "../features/mint/mint-ui.js";

export function initUiRoot() {
  initOverlay();
  initLocalTextureUi();
  initExportUi();
  initWalletUi();
  initNftPickerUi();
  initMintUi();
  initLeaderboardUi();
}
