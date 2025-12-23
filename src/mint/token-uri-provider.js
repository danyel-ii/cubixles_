function toBase64Json(value) {
  const json = JSON.stringify(value);
  const utf8 = encodeURIComponent(json);
  const safe = unescape(utf8);
  return `data:application/json;base64,${btoa(safe)}`;
}

export function buildTokenUri(metadata) {
  return toBase64Json(metadata);
}
