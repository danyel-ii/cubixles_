import {
  formatChainName,
  getChainOptions,
  getActiveChainId,
  hasStoredChainPreference,
  setActiveChainId,
  subscribeActiveChain,
} from "../../config/chains.js";

const networkUiState = {
  pickerRoot: null,
  pickerList: null,
  pickerClose: null,
  statusEl: null,
  selectButton: null,
  selectSubtitle: null,
};

function isTokenViewRoute() {
  if (typeof window === "undefined") {
    return false;
  }
  if (document?.body?.classList?.contains("is-token-view")) {
    return true;
  }
  const path = window.location?.pathname || "";
  return /^\/m\/\d+\/?$/.test(path);
}

function isBuilderMode() {
  if (typeof document === "undefined") {
    return false;
  }
  return document.body.classList.contains("is-builder");
}

function showNetworkPicker() {
  const { pickerRoot } = networkUiState;
  if (!pickerRoot) {
    return;
  }
  pickerRoot.classList.remove("is-hidden");
  document.body.classList.add("network-modal-open");
}

function hideNetworkPicker() {
  const { pickerRoot } = networkUiState;
  if (!pickerRoot) {
    return;
  }
  pickerRoot.classList.add("is-hidden");
  document.body.classList.remove("network-modal-open");
}

function renderNetworkOptions() {
  const { pickerList } = networkUiState;
  if (!pickerList) {
    return;
  }
  pickerList.innerHTML = "";
  const fragment = document.createDocumentFragment();
  const options = isBuilderMode()
    ? getChainOptions().filter((chain) => chain.id === 1)
    : getChainOptions();
  options.forEach((chain) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "network-picker-option";
    button.textContent = chain.name;
    button.addEventListener("click", () => {
      setActiveChainId(chain.id);
      hideNetworkPicker();
    });
    fragment.appendChild(button);
  });
  pickerList.appendChild(fragment);
}

function updateNetworkStatus(chainId) {
  const { statusEl } = networkUiState;
  if (!statusEl) {
    return;
  }
  const label = formatChainName(chainId);
  statusEl.textContent = `Network: ${label}`;
  if (networkUiState.selectSubtitle) {
    networkUiState.selectSubtitle.textContent = `currently connected to: ${label}`;
  }
}

export function initNetworkUi() {
  const pickerRoot = document.getElementById("network-picker");
  const pickerList = document.getElementById("network-picker-list");
  const pickerClose = document.getElementById("network-picker-close");
  const statusEl = document.getElementById("network-status");
  const selectButton = document.getElementById("network-select");
  const selectSubtitle = document.getElementById("network-select-subtitle");
  const builderMode = isBuilderMode();

  networkUiState.pickerRoot = pickerRoot;
  networkUiState.pickerList = pickerList;
  networkUiState.pickerClose = pickerClose;
  networkUiState.statusEl = statusEl;
  networkUiState.selectButton = selectButton;
  networkUiState.selectSubtitle = selectSubtitle;

  if (builderMode) {
    setActiveChainId(1);
  }

  renderNetworkOptions();
  updateNetworkStatus(getActiveChainId());

  if (!hasStoredChainPreference() && !isTokenViewRoute() && !builderMode) {
    showNetworkPicker();
  }

  if (pickerClose) {
    pickerClose.addEventListener("click", hideNetworkPicker);
  }
  if (pickerRoot) {
    pickerRoot.addEventListener("click", (event) => {
      if (event.target === pickerRoot) {
        hideNetworkPicker();
      }
    });
  }
  if (selectButton) {
    selectButton.addEventListener("click", showNetworkPicker);
  }

  subscribeActiveChain((chainId) => {
    updateNetworkStatus(chainId);
  });
}
