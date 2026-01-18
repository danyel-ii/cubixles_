"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const FACE_LAYOUTS = [
  { id: "+Z", className: "front" },
  { id: "-Z", className: "back" },
  { id: "+X", className: "right" },
  { id: "-X", className: "left" },
  { id: "+Y", className: "top" },
  { id: "-Y", className: "bottom" },
];

function pickFaceImage(face) {
  if (!face) {
    return null;
  }
  if (face.media?.imageCandidates?.length) {
    return face.media.imageCandidates[0] ?? null;
  }
  return face.media?.image ?? null;
}

function buildFaces(provenanceNFTs) {
  const byId = new Map();
  (provenanceNFTs || []).forEach((face) => {
    byId.set(face.faceId, face);
  });
  return FACE_LAYOUTS.map((layout) => {
    const face = byId.get(layout.id);
    const label = face?.collection || face?.title || `Face ${layout.id}`;
    return {
      id: layout.id,
      className: layout.className,
      label,
      image: pickFaceImage(face),
    };
  });
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function CubeCard({ item, index, reorderMode, onMove }) {
  const [rotation, setRotation] = useState({ x: 0, y: 0 });
  const dragRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    startRotX: 0,
    startRotY: 0,
  });

  const faces = useMemo(
    () => (item ? buildFaces(item.provenanceNFTs) : []),
    [item]
  );

  const onPointerDown = (event) => {
    if (!item || reorderMode) {
      return;
    }
    dragRef.current.active = true;
    dragRef.current.startX = event.clientX;
    dragRef.current.startY = event.clientY;
    dragRef.current.startRotX = rotation.x;
    dragRef.current.startRotY = rotation.y;
    if (event.currentTarget?.setPointerCapture) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  };

  const onPointerMove = (event) => {
    if (!dragRef.current.active || !item || reorderMode) {
      return;
    }
    const dx = event.clientX - dragRef.current.startX;
    const dy = event.clientY - dragRef.current.startY;
    const nextX = clamp(dragRef.current.startRotX + dy * 0.35, -80, 80);
    const nextY = dragRef.current.startRotY + dx * 0.45;
    setRotation({ x: nextX, y: nextY });
  };

  const onPointerUp = () => {
    dragRef.current.active = false;
  };

  if (!item) {
    return (
      <div className="paper-grid-card is-empty" aria-hidden="true">
        <div className="paper-grid-empty">Empty slot</div>
      </div>
    );
  }

  return (
    <div className="paper-grid-card">
      <div className="paper-grid-card-head">
        <span className="paper-grid-card-title">Token {item.tokenId}</span>
        {item.linkUrl ? (
          <a className="paper-grid-open" href={item.linkUrl}>
            Open
          </a>
        ) : null}
      </div>
      <div
        className="paper-grid-cube-wrap"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          className="paper-grid-cube"
          style={{
            "--grid-cube-rot-x": `${rotation.x}deg`,
            "--grid-cube-rot-y": `${rotation.y}deg`,
          }}
        >
          {faces.map((face) => (
            <div
              key={`${item.id}-${face.id}`}
              className={`paper-grid-face paper-grid-face-${face.className}`}
              style={{
                "--face-image": face.image ? `url("${face.image}")` : "none",
              }}
            >
              {!face.image ? (
                <span className="paper-grid-face-label">{face.label}</span>
              ) : null}
            </div>
          ))}
        </div>
      </div>
      {reorderMode ? (
        <div className="paper-grid-reorder">
          <button type="button" onClick={() => onMove(index, -3)}>
            Up
          </button>
          <button type="button" onClick={() => onMove(index, -1)}>
            Left
          </button>
          <button type="button" onClick={() => onMove(index, 1)}>
            Right
          </button>
          <button type="button" onClick={() => onMove(index, 3)}>
            Down
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function PaperCubeGrid({
  title,
  subtitle,
  items,
  status,
  actions,
}) {
  const [order, setOrder] = useState([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [reorderMode, setReorderMode] = useState(false);

  useEffect(() => {
    const ids = items.map((item) => item.id);
    setOrder((current) => {
      if (!current.length) {
        return ids;
      }
      const next = current.filter((id) => ids.includes(id));
      ids.forEach((id) => {
        if (!next.includes(id)) {
          next.push(id);
        }
      });
      return next;
    });
  }, [items]);

  const orderedItems = useMemo(() => {
    const map = new Map(items.map((item) => [item.id, item]));
    return order.map((id) => map.get(id)).filter(Boolean);
  }, [items, order]);

  const pageCount = Math.max(1, Math.ceil(orderedItems.length / 9));
  const currentPage = Math.min(pageIndex, pageCount - 1);
  const pageItems = orderedItems.slice(currentPage * 9, currentPage * 9 + 9);
  const slots = Array.from({ length: 9 }).map((_, index) => pageItems[index] || null);

  useEffect(() => {
    if (pageIndex > pageCount - 1) {
      setPageIndex(Math.max(0, pageCount - 1));
    }
  }, [pageCount, pageIndex]);

  const moveItem = (fromIndex, delta) => {
    const targetIndex = fromIndex + delta;
    if (targetIndex < 0 || targetIndex >= order.length) {
      return;
    }
    setOrder((current) => {
      const next = [...current];
      const temp = next[fromIndex];
      next[fromIndex] = next[targetIndex];
      next[targetIndex] = temp;
      return next;
    });
  };

  return (
    <main className="paper-grid-viewer">
      <header className="paper-grid-header">
        <div>
          <p className="paper-grid-eyebrow">Token viewer ext</p>
          <h1 className="paper-grid-title">{title}</h1>
          {subtitle ? <p className="paper-grid-subhead">{subtitle}</p> : null}
        </div>
        <div className="paper-grid-controls">
          {actions ? <div className="paper-grid-actions">{actions}</div> : null}
          <button
            type="button"
            className="paper-grid-button"
            onClick={() => setReorderMode((mode) => !mode)}
          >
            {reorderMode ? "Done" : "Reorder"}
          </button>
          <div className="paper-grid-pager">
            <button
              type="button"
              className="paper-grid-button"
              disabled={currentPage === 0}
              onClick={() => setPageIndex((value) => Math.max(0, value - 1))}
            >
              Prev
            </button>
            <span className="paper-grid-page">
              Page {currentPage + 1} / {pageCount}
            </span>
            <button
              type="button"
              className="paper-grid-button"
              disabled={currentPage + 1 >= pageCount}
              onClick={() =>
                setPageIndex((value) => Math.min(pageCount - 1, value + 1))
              }
            >
              Next
            </button>
          </div>
        </div>
      </header>

      {status ? <div className="paper-grid-status">{status}</div> : null}

      <section className="paper-grid">
        {slots.map((item, index) => {
          const globalIndex = currentPage * 9 + index;
          return (
            <CubeCard
              key={item ? item.id : `empty-${globalIndex}`}
              item={item}
              index={globalIndex}
              reorderMode={reorderMode}
              onMove={moveItem}
            />
          );
        })}
      </section>
    </main>
  );
}
