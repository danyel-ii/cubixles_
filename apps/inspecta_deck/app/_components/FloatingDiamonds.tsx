"use client";

import { useEffect, useRef } from "react";

type DiamondState = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  vRotation: number;
};

const CUBE_LINKS = [
  { href: "https://nodefoundation.com/", label: "Open Node Foundation" },
  { href: "https://less.ripe.wtf/", label: "Open less.ripe.wtf" },
  { href: "https://studybook.eth.link", label: "Open Studybook" },
];
const CUBE_COUNT = CUBE_LINKS.length;
const CUBE_SIZE = 36;
const RUBIK_FACES = [
  [
    "#f6c933",
    "#f3f1e7",
    "#d4362a",
    "#1a5fd6",
    "#f6c933",
    "#1b9c53",
    "#f28c28",
    "#f6c933",
    "#1a5fd6",
  ],
  [
    "#1b9c53",
    "#f3f1e7",
    "#1a5fd6",
    "#f28c28",
    "#1b9c53",
    "#d4362a",
    "#f6c933",
    "#1b9c53",
    "#f28c28",
  ],
  [
    "#1a5fd6",
    "#f6c933",
    "#f3f1e7",
    "#d4362a",
    "#1a5fd6",
    "#f28c28",
    "#1b9c53",
    "#1a5fd6",
    "#d4362a",
  ],
];

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function createState(width: number, height: number): DiamondState {
  return {
    x: randomBetween(0, Math.max(0, width - CUBE_SIZE)),
    y: randomBetween(0, Math.max(0, height - CUBE_SIZE)),
    vx: randomBetween(-0.7, 0.7),
    vy: randomBetween(-0.7, 0.7),
    rotation: randomBetween(-12, 12),
    vRotation: randomBetween(-0.12, 0.12),
  };
}

export default function FloatingDiamonds() {
  const anchorsRef = useRef<(HTMLAnchorElement | null)[]>([]);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const nodes = anchorsRef.current.filter(
      (node): node is HTMLAnchorElement => Boolean(node)
    );
    if (!nodes.length) {
      return;
    }

    let width = window.innerWidth;
    let height = window.innerHeight;
    const states = nodes.map(() => createState(width, height));

    const animate = () => {
      width = window.innerWidth;
      height = window.innerHeight;

      nodes.forEach((node, index) => {
        const state = states[index];
        if (!state) {
          return;
        }

        state.x += state.vx;
        state.y += state.vy;
        state.rotation += state.vRotation;

        if (state.x > width + CUBE_SIZE) {
          state.x = -CUBE_SIZE;
        }
        if (state.x < -CUBE_SIZE) {
          state.x = width + CUBE_SIZE;
        }
        if (state.y > height + CUBE_SIZE) {
          state.y = -CUBE_SIZE;
        }
        if (state.y < -CUBE_SIZE) {
          state.y = height + CUBE_SIZE;
        }

        node.style.transform = `translate3d(${state.x}px, ${state.y}px, 0) rotate(${state.rotation}deg)`;
      });

      animationRef.current = window.requestAnimationFrame(animate);
    };

    const handleResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
    };

    window.addEventListener("resize", handleResize);
    animationRef.current = window.requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (animationRef.current) {
        window.cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <>
      {Array.from({ length: CUBE_COUNT }).map((_, index) => {
        const colors = RUBIK_FACES[index % RUBIK_FACES.length];
        const link = CUBE_LINKS[index % CUBE_LINKS.length];
        return (
          <a
            key={`cube-${index}`}
            ref={(node) => {
              anchorsRef.current[index] = node;
            }}
            className="floating-tile"
            href={link.href}
            target="_blank"
            rel="noreferrer"
          >
            <span className="sr-only">{link.label}</span>
            {colors.map((color, tileIndex) => (
              <span
                key={`cubelet-${index}-${tileIndex}`}
                className="floating-cubelet"
                style={{ backgroundColor: color }}
              />
            ))}
          </a>
        );
      })}
    </>
  );
}
