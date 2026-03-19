"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Mic, Bus, Receipt, GitMerge, AlertTriangle, SlidersHorizontal } from "lucide-react";
import type { Feature } from "@/types";

const features: Feature[] = [
  {
    id: "voice",
    icon: "mic",
    title: "Voice Search",
    description:
      "Say your destination in Filipino or English — Sakai understands local place names and landmarks.",
  },
  {
    id: "jeepney",
    icon: "bus",
    title: "Jeepney-First Routing",
    description:
      "Routes built around jeepney lines, not just roads. Real coverage for how Metro Manila actually moves.",
  },
  {
    id: "fare",
    icon: "receipt",
    title: "Fare Transparency",
    description:
      "See the exact breakdown before you board. No surprises — know what each leg of your trip costs.",
  },
  {
    id: "multimodal",
    icon: "merge",
    title: "Multimodal Routing",
    description:
      "Combines jeepney, MRT, LRT, bus, and walking into a single clear commute plan.",
  },
  {
    id: "mmda",
    icon: "alert",
    title: "MMDA Alerts",
    description:
      "Real-time traffic and road closure alerts from MMDA, surfaced when they affect your route.",
  },
  {
    id: "prefs",
    icon: "sliders",
    title: "Route Preferences",
    description:
      "Prefer fewer transfers? Faster travel? Set your priorities and Sakai optimizes accordingly.",
  },
];

const iconMap: Record<string, React.ReactNode> = {
  mic: <Mic size={22} />,
  bus: <Bus size={22} />,
  receipt: <Receipt size={22} />,
  merge: <GitMerge size={22} />,
  alert: <AlertTriangle size={22} />,
  sliders: <SlidersHorizontal size={22} />,
};

function FeatureCard({ feature, index }: { feature: Feature; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.85", "start 0.35"],
  });
  const isEven = index % 2 === 0;
  const x = useTransform(scrollYProgress, [0, 1], [isEven ? -80 : 80, 0]);
  const opacity = useTransform(scrollYProgress, [0, 0.6], [0, 1]);

  return (
    <motion.div
      ref={ref}
      style={{
        x,
        opacity,
        maxWidth: "65%",
        marginLeft: isEven ? 0 : "auto",
        marginRight: isEven ? "auto" : 0,
      }}
      className="relative card-surface rounded-2xl p-8 overflow-hidden"
    >
      {/* Background large number */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: "-0.15em",
          right: isEven ? "0.75rem" : "auto",
          left: isEven ? "auto" : "0.75rem",
          fontFamily: "var(--font-display)",
          fontSize: "clamp(5rem, 12vw, 9rem)",
          fontWeight: 800,
          color: "rgba(0,122,255,0.06)",
          lineHeight: 1,
          pointerEvents: "none",
          userSelect: "none",
        }}
      >
        {String(index + 1).padStart(2, "0")}
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col gap-4">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(0,122,255,0.1)", color: "#007AFF" }}
        >
          {iconMap[feature.icon]}
        </div>
        <div>
          <h3 className="font-semibold text-base mb-1.5" style={{ color: "var(--text-primary)" }}>
            {feature.title}
          </h3>
          <p className="text-sm leading-relaxed" style={{ color: "var(--text-sub)" }}>
            {feature.description}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

export default function Features() {
  return (
    <section id="features" className="py-24 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-20"
        >
          <span
            className="inline-block text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full mb-4"
            style={{
              background: "rgba(0,122,255,0.08)",
              color: "#007AFF",
              border: "1px solid rgba(0,122,255,0.15)",
            }}
          >
            Features
          </span>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(2.5rem, 6vw, 4rem)",
              fontWeight: 700,
              color: "var(--text-primary)",
              lineHeight: 1.1,
            }}
          >
            Six reasons locals choose Sakai
          </h2>
        </motion.div>

        {/* Alternating cards */}
        <div className="flex flex-col gap-6">
          {features.map((feature, i) => (
            <FeatureCard key={feature.id} feature={feature} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
