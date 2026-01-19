"use client";

import { useCallback, useId, useState } from "react";

type PanelExplanationProps = {
  summary: string;
  description: string;
  ariaLabel?: string;
};

export default function PanelExplanation({
  summary,
  description,
  ariaLabel = "Toggle explanation",
}: PanelExplanationProps) {
  const [open, setOpen] = useState(false);
  const id = useId();

  const toggle = useCallback(() => {
    setOpen((prev) => !prev);
  }, []);

  return (
    <div className="panel-explanation">
      <button
        type="button"
        className="panel-explanation-trigger"
        aria-controls={`panel-explanation-${id}`}
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={toggle}
      >
        ?
      </button>
      {open && (
        <div id={`panel-explanation-${id}`} className="panel-explanation-popover">
          <p className="panel-explanation-summary">{summary}</p>
          <p className="panel-explanation-description">{description}</p>
        </div>
      )}
    </div>
  );
}
