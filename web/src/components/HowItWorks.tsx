"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { Mic, Map, Navigation } from "lucide-react";
import type { Step } from "@/types";

const steps: Step[] = [
  {
    number: 1,
    icon: "mic",
    title: "Speak",
    description: "Tell Sakai where you want to go. Use a landmark, barangay name, or just describe it.",
  },
  {
    number: 2,
    icon: "map",
    title: "Plan",
    description: "Sakai finds the best jeepney and transit combination with fare, time, and transfer details.",
  },
  {
    number: 3,
    icon: "nav",
    title: "Go",
    description: "Follow turn-by-turn guidance with live MMDA alerts to arrive without guesswork.",
  },
];

const iconMap: Record<string, React.ReactNode> = {
  mic: <Mic size={24} />,
  map: <Map size={24} />,
  nav: <Navigation size={24} />,
};

export default function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.8", "end 0.5"],
  });
  const lineScaleY = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <section id="how-it-works" className="py-24 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span
            className="inline-block text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full mb-4"
            style={{
              background: "rgba(0,122,255,0.08)",
              color: "#007AFF",
              border: "1px solid rgba(0,122,255,0.15)",
            }}
          >
            How It Works
          </span>
          <h2
            className="text-3xl sm:text-4xl font-bold tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            Three steps to your commute
          </h2>
        </motion.div>

        {/* Steps with animated connector */}
        <div ref={ref} className="relative">
          {/* Connector line */}
          <div
            className="absolute left-9 top-10 bottom-10 w-0.5 hidden sm:block"
            style={{ background: "var(--card-border)" }}
          >
            <motion.div
              className="absolute inset-0 origin-top"
              style={{
                scaleY: lineScaleY,
                background: "#007AFF",
                opacity: 0.5,
              }}
            />
          </div>

          {/* Step cards */}
          <div className="flex flex-col gap-6">
            {steps.map((step, idx) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, x: -24 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.55, delay: idx * 0.15, ease: "easeOut" }}
                className="flex items-start gap-5"
              >
                {/* Icon bubble */}
                <motion.div
                  whileInView={{ scale: [0.7, 1.1, 1] }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: idx * 0.15 + 0.1 }}
                  className="flex-shrink-0 w-[72px] h-[72px] rounded-2xl flex items-center justify-center z-10"
                  style={{
                    background: "#007AFF",
                    color: "#ffffff",
                    boxShadow: "0 4px 24px rgba(0,122,255,0.3)",
                  }}
                >
                  {iconMap[step.icon]}
                </motion.div>

                {/* Content */}
                <div className="card-surface rounded-2xl p-5 flex-1">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className="text-xs font-bold uppercase tracking-widest"
                      style={{ color: "#007AFF" }}
                    >
                      Step {step.number}
                    </span>
                  </div>
                  <h3
                    className="text-lg font-semibold mb-1"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {step.title}
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--text-sub)" }}>
                    {step.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
