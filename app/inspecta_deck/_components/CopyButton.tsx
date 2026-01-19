"use client";

import { useEffect, useRef, useState } from "react";

type CopyButtonProps = {
  value: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
};

const COPY_RESET_MS = 1600;

export default function CopyButton({
  value,
  label = "Copy",
  copiedLabel = "Copied",
  className,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  const scheduleReset = () => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = window.setTimeout(() => {
      setCopied(false);
    }, COPY_RESET_MS);
  };

  const tryClipboardWrite = async () => {
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      return false;
    }
    await navigator.clipboard.writeText(value);
    return true;
  };

  const tryFallbackCopy = () => {
    if (typeof document === "undefined") {
      return false;
    }
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "absolute";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand("copy");
    document.body.removeChild(textarea);
    return success;
  };

  const handleCopy = async () => {
    if (!value) {
      return;
    }
    try {
      const copiedToClipboard = await tryClipboardWrite();
      if (!copiedToClipboard && !tryFallbackCopy()) {
        return;
      }
      setCopied(true);
      scheduleReset();
    } catch {
      if (tryFallbackCopy()) {
        setCopied(true);
        scheduleReset();
      }
    }
  };

  useEffect(
    () => () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    },
    []
  );

  return (
    <button
      type="button"
      className={["token-copy-button", className].filter(Boolean).join(" ")}
      onClick={handleCopy}
      aria-live="polite"
      aria-label={label}
      title={copied ? copiedLabel : label}
      data-copied={copied ? "true" : "false"}
    >
      {copied ? copiedLabel : label}
    </button>
  );
}
