"use client";

import { CUBIXLES_LOGO_GLYPH, CUBIXLES_LOGO_TEXT } from "../_lib/logo";

type CubixlesLogoProps = {
  className?: string;
};

export default function CubixlesLogo({ className }: CubixlesLogoProps) {
  return (
    <span className={["cubixles-logo", className].filter(Boolean).join(" ")}>
      <span aria-hidden="true">{CUBIXLES_LOGO_GLYPH}</span>
      <span className="sr-only">{CUBIXLES_LOGO_TEXT}</span>
    </span>
  );
}
