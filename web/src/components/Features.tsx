"use client";

import { motion } from "framer-motion";
import { Mic, Bus, Receipt, GitMerge, AlertTriangle, SlidersHorizontal } from "lucide-react";
import type { Feature } from "@/types";

const features: Feature[] = [
  {
    id: "voice",
    icon: "mic",
    title: "Voice Search",
    description: "Say your destination in Filipino or English — Sakai understands local place names and landmarks.",
  },
  {
    id: "jeepney",
    icon: "bus",
    title: "Jeepney-First Routing",
    description: "Routes built around jeepney lines, not just roads. Real coverage for how Metro Manila actually moves.",
  },
  {
    id: "fare",
    icon: "receipt",
    title: "Fare Transparency",
    description: "See the exact breakdown before you board. No surprises — know what each leg of your trip costs.",
  },
  {
    id: "multimodal",
    icon: "merge",
    title: "Multimodal Routing",
    description: "Combines jeepney, MRT, LRT, bus, and walking into a single clear commute plan.",
  },
  {
    id: "mmda",
    icon: "alert",
    title: "MMDA Alerts",
    description: "Real-time traffic and road closure alerts from MMDA, surfaced when they affect your route.",
  },
  {
    id: "prefs",
    icon: "sliders",
    title: "Route Preferences",
    description: "Prefer fewer transfers? Faster travel? Set your priorities and Sakai optimizes accordingly.",
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

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: "easeOut" } },
};

export default function Features() {
  return (
    <section id="features" className="py-24 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
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
            Features
          </span>
          <h2
            className="text-3xl sm:text-4xl font-bold tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            Built for the real Metro Manila commute
          </h2>
          <p className="mt-4 text-base max-w-xl mx-auto" style={{ color: "var(--text-sub)" }}>
            Not a port of foreign transit apps. Sakai is designed from the ground up for jeepney culture and local transit realities.
          </p>
        </motion.div>

        {/* Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
        >
          {features.map((feature) => (
            <motion.div
              key={feature.id}
              variants={cardVariants}
              className="card-surface rounded-2xl p-6 flex flex-col gap-4 hover:shadow-md transition-shadow"
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{
                  background: "rgba(0,122,255,0.1)",
                  color: "#007AFF",
                }}
              >
                {iconMap[feature.icon]}
              </div>
              <div>
                <h3
                  className="font-semibold text-base mb-1.5"
                  style={{ color: "var(--text-primary)" }}
                >
                  {feature.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-sub)" }}>
                  {feature.description}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
