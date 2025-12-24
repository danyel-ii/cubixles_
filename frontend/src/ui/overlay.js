export function initOverlay() {
  const overlay = document.getElementById("overlay");
  const enterButton = document.getElementById("enter-btn");
  if (!overlay || !enterButton) {
    return;
  }

  const storageKey = "cubeless_overlay_dismissed";
  const hasDismissed = localStorage.getItem(storageKey) === "1";
  if (hasDismissed) {
    overlay.classList.add("is-hidden");
    return;
  }

  function dismiss() {
    overlay.classList.add("is-hidden");
    localStorage.setItem(storageKey, "1");
  }

  enterButton.addEventListener("click", () => dismiss());
}
