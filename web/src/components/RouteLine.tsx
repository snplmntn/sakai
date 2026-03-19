"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import type { MotionValue } from "framer-motion";

type Stop = {
  id: string;
  label: string;
  x: number;
  y: number;
  revealAt: number;
};

const stops: Stop[] = [
  { id: "start",    label: "Start",   x: 60,  y: 200, revealAt: 0.08 },
  { id: "cubao",    label: "Cubao",   x: 150, y: 140, revealAt: 0.22 },
  { id: "araneta",  label: "Araneta", x: 260, y: 110, revealAt: 0.36 },
  { id: "edsa",     label: "EDSA",    x: 370, y: 150, revealAt: 0.50 },
  { id: "makati",   label: "Makati",  x: 480, y: 110, revealAt: 0.65 },
  { id: "bgc",      label: "BGC",     x: 580, y: 150, revealAt: 0.80 },
  { id: "end",      label: "",        x: 660, y: 200, revealAt: 0.94 },
];

const PATH =
  "M60,200 C90,170 120,140 150,140 C190,140 220,110 260,110 C300,110 340,150 370,150 C420,150 450,110 480,110 C520,110 555,150 580,150 C610,150 635,180 660,200";

function StopDot({
  stop,
  scrollYProgress,
}: {
  stop: Stop;
  scrollYProgress: MotionValue<number>;
}) {
  const from = Math.max(0.001, stop.revealAt - 0.06);
  const opacity = useTransform(scrollYProgress, [from, stop.revealAt], [0, 1]);
  const scale = useTransform(scrollYProgress, [from, stop.revealAt], [0, 1]);

  return (
    <motion.circle
      cx={stop.x}
      cy={stop.y}
      r={8}
      fill="#007AFF"
      style={{ opacity, scale, originX: "50%", originY: "50%" }}
    />
  );
}

export default function RouteLine() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.8", "end 0.3"],
  });
  const pathLength = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <div ref={ref} className="py-12 px-4 overflow-hidden" style={{ background: "var(--bg-from)" }}>
      <div className="max-w-3xl mx-auto">
        <p
          className="text-center text-xs uppercase tracking-widest mb-8"
          style={{ color: "#007AFF", fontFamily: "var(--font-mono)" }}
        >
          Your Route
        </p>
        <svg
          viewBox="0 0 720 280"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ width: "100%", height: "auto" }}
        >
          {/* Track (ghost path) */}
          <path
            d={PATH}
            stroke="rgba(0,122,255,0.12)"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
          />

          {/* Animated draw path */}
          <motion.path
            d={PATH}
            stroke="#007AFF"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
            style={{ pathLength }}
          />

          {/* Stop circles */}
          {stops.map((stop) => (
            <StopDot key={stop.id} stop={stop} scrollYProgress={scrollYProgress} />
          ))}

          {/* Labels */}
          {stops
            .filter((s) => s.label)
            .map((stop) => (
              <text
                key={`label-${stop.id}`}
                x={stop.x}
                y={stop.y + 26}
                textAnchor="middle"
                fontSize="11"
                fill="var(--text-sub)"
                fontFamily="var(--font-mono)"
              >
                {stop.label}
              </text>
            ))}
        </svg>
      </div>
    </div>
  );
}
