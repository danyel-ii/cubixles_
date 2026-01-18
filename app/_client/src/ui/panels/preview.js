import { state } from "../../app/app-state.js";
import { formatChainName, getActiveChainId } from "../../config/chains.js";
import { getWalletState } from "../../features/wallet/wallet.js";

const PREVIEW_STORAGE_KEY = "cubixles:m2-preview";
const PREVIEW_PATH = "/m2/preview";

function isBuilderMode() {
  if (typeof document === "undefined") {
    return false;
  }
  return document.body.classList.contains("is-builder");
}

function buildPreviewPayload() {
  const selection = Array.isArray(state.nftSelection) ? state.nftSelection : [];
  const wallet = getWalletState();
  return {
    tokenId: "preview",
    description: "",
    mintedAt: new Date().toISOString(),
    mintedBy: wallet?.address || "",
    network: formatChainName(getActiveChainId()),
    faces: selection.map((nft) => ({
      tokenId: nft.tokenId,
      contractAddress: nft.contractAddress,
      collectionName: nft.collectionName || null,
      name: nft.name || null,
      image: nft.image?.resolved || nft.image?.original || null,
    })),
  };
}

export function initPreviewUi() {
  const previewButton = document.getElementById("ui-preview");
  const previewBar = document.getElementById("preview-bar");
  const previewBack = document.getElementById("preview-back");
  const uiPanel = document.getElementById("ui");
  if (!previewButton || !previewBar || !previewBack || !uiPanel) {
    return;
  }

  function setPreview(enabled) {
    document.body.classList.toggle("is-preview", enabled);
    uiPanel.classList.toggle("is-hidden", enabled);
    previewBar.classList.toggle("is-hidden", !enabled);
  }

  previewButton.addEventListener("click", () => {
    if (isBuilderMode()) {
      try {
        const payload = buildPreviewPayload();
        window.localStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(payload));
      } catch (error) {
        void error;
      }
      window.open(PREVIEW_PATH, "_blank", "noopener");
      return;
    }
    setPreview(true);
  });
  previewBack.addEventListener("click", () => setPreview(false));

  document.addEventListener("mint-complete", () => {
    document.body.classList.add("is-minted");
    uiPanel.classList.add("is-hidden");
    previewBar.classList.add("is-hidden");
  });
}
