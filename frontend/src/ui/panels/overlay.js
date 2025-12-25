export function initOverlay() {
  const overlay = document.getElementById("overlay");
  const enterButton = document.getElementById("enter-btn");
  const leaderboardButton = document.getElementById("overlay-leaderboard");
  const aboutButton = document.getElementById("overlay-about");
  const aboutPanel = document.getElementById("overlay-about-panel");
  if (!overlay || !enterButton) {
    return;
  }

  function show() {
    overlay.classList.remove("is-hidden");
  }

  function dismiss() {
    overlay.classList.add("is-hidden");
  }

  enterButton.addEventListener("click", () => dismiss());
  if (leaderboardButton) {
    leaderboardButton.addEventListener("click", () => {
      dismiss();
      document.dispatchEvent(new CustomEvent("open-leaderboard"));
    });
  }
  if (aboutButton && aboutPanel) {
    aboutButton.addEventListener("click", () => {
      aboutPanel.classList.toggle("is-open");
    });
  }

  document.addEventListener("open-overlay", show);
}
