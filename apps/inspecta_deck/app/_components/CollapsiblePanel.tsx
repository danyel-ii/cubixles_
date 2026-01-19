"use client";

import {
  useCallback,
  useId,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";

type CollapsiblePanelProps = {
  eyebrow?: string;
  title: ReactNode;
  subhead?: string;
  actions?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  titleAs?: "h1" | "h2" | "h3";
  collapsible?: boolean;
};

export default function CollapsiblePanel({
  eyebrow,
  title,
  subhead,
  actions,
  children,
  defaultOpen = false,
  titleAs = "h2",
  collapsible = true,
}: CollapsiblePanelProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentId = useId();
  const isCollapsible = collapsible;

  const isExpanded = isCollapsible ? isOpen : true;

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const handleHeaderClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (!isCollapsible) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (!target) {
        handleToggle();
        return;
      }

      if (target.closest("a, button, input, textarea, select")) {
        return;
      }

      handleToggle();
    },
    [handleToggle, isCollapsible]
  );

  const handleHeaderKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (!isCollapsible) {
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleToggle();
      }
    },
    [handleToggle, isCollapsible]
  );

  const TitleTag = titleAs;

  return (
    <section
      className={`provenance-panel panel-collapsible ${
        isExpanded ? "expanded" : "collapsed"
      }`}
    >
      <div
        className="panel-header panel-collapsible-header"
        onClick={isCollapsible ? handleHeaderClick : undefined}
        onKeyDown={isCollapsible ? handleHeaderKeyDown : undefined}
        role={isCollapsible ? "button" : undefined}
        tabIndex={isCollapsible ? 0 : undefined}
        aria-expanded={isCollapsible ? isExpanded : undefined}
        aria-controls={isCollapsible ? contentId : undefined}
      >
        <div>
          {eyebrow && <p className="panel-eyebrow">{eyebrow}</p>}
          <TitleTag className="panel-title">{title}</TitleTag>
          {subhead && <p className="panel-subhead">{subhead}</p>}
        </div>
        <div className="panel-collapsible-actions" data-panel-interactive="true">
          {actions}
          {isCollapsible && !isExpanded && (
            <button
              type="button"
              className="panel-collapse-toggle"
              onClick={(event) => {
                event.stopPropagation();
                handleToggle();
              }}
              aria-expanded={isExpanded}
              aria-controls={contentId}
            >
              Expand
            </button>
          )}
        </div>
      </div>
      <div id={contentId} className="panel-collapsible-body">
        {children}
      </div>
    </section>
  );
}
