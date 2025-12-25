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

  previewButton.addEventListener("click", () => setPreview(true));
  previewBack.addEventListener("click", () => setPreview(false));

  document.addEventListener("mint-complete", () => {
    document.body.classList.add("is-minted");
    uiPanel.classList.add("is-hidden");
    previewBar.classList.add("is-hidden");
  });
}
