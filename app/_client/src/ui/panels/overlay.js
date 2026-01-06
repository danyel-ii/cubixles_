export function initOverlay() {
  const overlay = document.getElementById("overlay");
  const enterButton = document.getElementById("enter-btn");
  const leaderboardButton = document.getElementById("overlay-leaderboard");
  const aboutButton = document.getElementById("overlay-about");
  const aboutPanel = document.getElementById("overlay-about-panel");
  const root = document.body;
  if (!overlay || !enterButton) {
    return;
  }

  function setOverlayActive(active) {
    if (!root) {
      return;
    }
    root.classList.toggle("overlay-active", active);
  }

  function shouldActivateOverlay() {
    if (!root) {
      return false;
    }
    if (root.classList.contains("is-token-view")) {
      return false;
    }
    return !overlay.classList.contains("is-hidden");
  }

  function show() {
    overlay.classList.remove("is-hidden");
    setOverlayActive(!root?.classList.contains("is-token-view"));
    document.dispatchEvent(new CustomEvent("overlay-opened"));
  }

  function dismiss() {
    requestAnimationFrame(() => {
      overlay.classList.add("is-hidden");
      setOverlayActive(false);
      document.dispatchEvent(new CustomEvent("overlay-closed"));
    });
  }

  enterButton.addEventListener("click", (event) => {
    event.preventDefault();
    dismiss();
  });
  if (leaderboardButton) {
    leaderboardButton.addEventListener("click", (event) => {
      event.preventDefault();
      dismiss();
      document.dispatchEvent(new CustomEvent("open-leaderboard"));
    });
  }
  if (aboutButton && aboutPanel) {
    aboutButton.addEventListener("click", (event) => {
      event.preventDefault();
      aboutPanel.classList.toggle("is-open");
    });
  }

  setOverlayActive(shouldActivateOverlay());
  document.addEventListener("open-overlay", show);
}
