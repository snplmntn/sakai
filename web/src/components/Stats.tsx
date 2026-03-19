"use client";

import { motion, useInView, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect, useRef } from "react";
import type { Stat } from "@/types";

const stats: Stat[] = [
  { id: "routes", value: 420, suffix: "+", label: "Jeepney Routes" },
  { id: "stops", value: 8500, suffix: "+", label: "Mapped Stops" },
  { id: "commutes", value: 12000, suffix: "+", label: "Daily Commutes Planned" },
];

function AnimatedCounter({ value, suffix }: { value: number; suffix: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => Math.round(latest).toLocaleString());

  useEffect(() => {
    if (!inView) return;
    const controls = animate(count, value, { duration: 1.8, ease: "easeOut" });
    return controls.stop;
  }, [inView, count, value]);

  return (
    <span ref={ref} className="tabular-nums">
      <motion.span>{rounded}</motion.span>
      {suffix}
    </span>
  );
}

export default function Stats() {
  return (
    <section className="py-20 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center uppercase tracking-widest text-xs mb-16"
          style={{ color: "#007AFF", fontFamily: "var(--font-impact)", letterSpacing: "0.18em" }}
        >
          By The Numbers
        </motion.p>

        <div className="flex flex-col sm:flex-row items-stretch justify-center">
          {stats.map((stat, idx) => (
            <motion.div
              key={stat.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.12 }}
              className="flex-1 flex flex-col items-center py-8 px-6 sm:px-10"
              style={{
                borderRight:
                  idx < stats.length - 1 ? "1px solid var(--card-border)" : "none",
              }}
            >
              <p
                style={{
                  fontFamily: "var(--font-impact)",
                  fontSize: "clamp(4rem, 10vw, 9rem)",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  lineHeight: 1,
                }}
              >
                <AnimatedCounter value={stat.value} suffix={stat.suffix} />
              </p>
              <p
                className="mt-3 text-sm uppercase tracking-widest text-center"
                style={{ color: "var(--text-sub)" }}
              >
                {stat.label}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
