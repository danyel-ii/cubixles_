"use client";

import { useEffect, useMemo, useState } from "react";

type FallbackImageProps = {
  candidates?: string[];
  alt: string;
  className?: string;
  placeholderClassName?: string;
  placeholderLabel?: string;
};

export default function FallbackImage({
  candidates = [],
  alt,
  className,
  placeholderClassName,
  placeholderLabel = "No image resolved",
}: FallbackImageProps) {
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const candidatesKey = useMemo(() => candidates.join("|"), [candidates]);

  useEffect(() => {
    setIndex(0);
    setFailed(false);
  }, [candidatesKey]);

  if (!candidates.length || failed) {
    return (
      <div className={placeholderClassName}>
        {placeholderLabel}
      </div>
    );
  }

  return (
    <img
      src={candidates[index]}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => {
        if (index < candidates.length - 1) {
          setIndex((prev) => prev + 1);
        } else {
          setFailed(true);
        }
      }}
    />
  );
}
