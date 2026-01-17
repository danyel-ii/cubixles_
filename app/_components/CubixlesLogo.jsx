"use client";

import { CUBIXLES_LOGO_GLYPH, CUBIXLES_LOGO_TEXT } from "../_lib/logo.js";

export default function CubixlesLogo({ className = "" }) {
  const classes = ["cubixles-logo", className].filter(Boolean).join(" ");
  return (
    <span className={classes}>
      <span aria-hidden="true">{CUBIXLES_LOGO_GLYPH}</span>
      <span className="sr-only">{CUBIXLES_LOGO_TEXT}</span>
    </span>
  );
}
