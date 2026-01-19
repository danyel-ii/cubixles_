"use client";

import { Fragment } from "react";
import CubixlesLogo from "./CubixlesLogo";

type CubixlesTextProps = {
  text: string;
  className?: string;
};

const LOGO_TOKEN = /cubixles_/gi;

export default function CubixlesText({ text, className }: CubixlesTextProps) {
  const parts = text.split(LOGO_TOKEN);
  if (parts.length === 1) {
    return <span className={className}>{text}</span>;
  }

  return (
    <span className={className}>
      {parts.map((part, index) => (
        <Fragment key={`${part}-${index}`}>
          {part}
          {index < parts.length - 1 && (
            <CubixlesLogo className="cubixles-logo-inline" />
          )}
        </Fragment>
      ))}
    </span>
  );
}
