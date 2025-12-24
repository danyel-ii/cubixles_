import { handleExport } from "../app/app-exporter.js";

export function initExportUi() {
  const exportButton = document.getElementById("export-html");
  if (!exportButton) {
    return;
  }
  exportButton.addEventListener("click", handleExport);
}
