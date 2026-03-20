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
      <div className="mx-auto w-full max-w-none">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center uppercase tracking-widest mb-16 text-base sm:text-lg lg:text-xl uppercase "
          style={{ color: "#007AFF", fontFamily: "var(--font-impact)", letterSpacing: "0.18em" }}
        >
          By The Numbers
        </motion.p>

        <div className="grid grid-cols-1 items-stretch justify-center overflow-hidden rounded-[28px] border border-[var(--card-border)] sm:grid-cols-3">
          {stats.map((stat, idx) => (
            <motion.div
              key={stat.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.12 }}
              className={[
                "flex min-w-0 flex-col items-center px-4 py-6 sm:px-4 sm:py-8",
                idx < stats.length - 1 ? "border-b border-[var(--card-border)] sm:border-b-0 sm:border-r" : "",
              ].join(" ")}
            >
              <p
                className="w-full text-center"
                style={{
                  fontFamily: "var(--font-impact)",
                  fontSize: "clamp(2.5rem, 12vw, 4.9rem)",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  lineHeight: 0.9,
                  whiteSpace: "nowrap",
                }}
              >
                <AnimatedCounter value={stat.value} suffix={stat.suffix} />
              </p>
              <p
                className="mt-2 max-w-[12ch] text-center text-sm uppercase tracking-[0.06em] sm:mt-3 sm:max-w-full sm:text-base sm:tracking-[0.12em]"
                style={{ color: "var(--text-sub)", textWrap: "balance" }}
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
