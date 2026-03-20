"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import Image from "next/image";

function PhoneMockup() {
  return (
    <div className="relative mx-auto w-full max-w-[20rem] px-4 sm:max-w-56 sm:px-0">
      <svg
        viewBox="0 0 224 460"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full drop-shadow-2xl"
      >
        <rect x="2" y="2" width="220" height="456" rx="36" fill="#1A2E44" stroke="#2A4A66" strokeWidth="2" />
        <rect x="12" y="14" width="200" height="432" rx="28" fill="#0A1929" />
        <rect x="80" y="16" width="64" height="20" rx="10" fill="#1A2E44" />
        <circle cx="92" cy="26" r="4" fill="#2A4A66" />
        <circle cx="112" cy="26" r="3" fill="#007AFF" opacity="0.7" />
        <rect x="20" y="50" width="80" height="10" rx="5" fill="#A0B4C8" opacity="0.4" />
        <rect x="170" y="48" width="30" height="14" rx="7" fill="#007AFF" opacity="0.8" />
        <rect x="20" y="76" width="184" height="36" rx="12" fill="#1A2E44" />
        <circle cx="40" cy="94" r="6" fill="#007AFF" opacity="0.6" />
        <rect x="54" y="90" width="80" height="8" rx="4" fill="#A0B4C8" opacity="0.3" />
        <rect x="20" y="128" width="184" height="60" rx="12" fill="#1E3550" />
        <rect x="32" y="140" width="24" height="24" rx="8" fill="#007AFF" opacity="0.2" />
        <circle cx="44" cy="152" r="6" fill="#007AFF" opacity="0.8" />
        <rect x="64" y="140" width="100" height="8" rx="4" fill="#F7FBFE" opacity="0.7" />
        <rect x="64" y="156" width="70" height="6" rx="3" fill="#A0B4C8" opacity="0.4" />
        <rect x="156" y="144" width="36" height="14" rx="7" fill="#007AFF" opacity="0.15" />
        <rect x="158" y="148" width="32" height="6" rx="3" fill="#007AFF" opacity="0.8" />
        <rect x="20" y="200" width="184" height="60" rx="12" fill="#1E3550" opacity="0.7" />
        <rect x="32" y="212" width="24" height="24" rx="8" fill="#34C759" opacity="0.15" />
        <circle cx="44" cy="224" r="6" fill="#34C759" opacity="0.8" />
        <rect x="64" y="212" width="88" height="8" rx="4" fill="#F7FBFE" opacity="0.6" />
        <rect x="64" y="228" width="60" height="6" rx="3" fill="#A0B4C8" opacity="0.35" />
        <rect x="156" y="216" width="36" height="14" rx="7" fill="#34C759" opacity="0.12" />
        <rect x="158" y="220" width="32" height="6" rx="3" fill="#34C759" opacity="0.7" />
        <rect x="20" y="276" width="184" height="100" rx="12" fill="#0E2236" />
        <path
          d="M40 340 Q80 300 120 320 Q160 340 184 310"
          stroke="#007AFF"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
          opacity="0.7"
        />
        <circle cx="40" cy="340" r="5" fill="#007AFF" opacity="0.9" />
        <circle cx="184" cy="310" r="5" fill="#34C759" opacity="0.9" />
        <rect x="20" y="392" width="184" height="44" rx="12" fill="#1A2E44" />
        <circle cx="68" cy="414" r="8" fill="#007AFF" opacity="0.8" />
        <circle cx="112" cy="414" r="6" fill="#A0B4C8" opacity="0.3" />
        <circle cx="156" cy="414" r="6" fill="#A0B4C8" opacity="0.3" />
      </svg>

      <motion.div
        initial={{ opacity: 0, x: 24, y: -8 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ delay: 0.9, duration: 0.6, ease: "easeOut" }}
        className="absolute right-4 top-16 rounded-xl p-3 shadow-xl sm:-right-10"
        style={{
          background: "var(--card-surface)",
          border: "1px solid var(--card-border)",
          minWidth: "120px",
          maxWidth: "10rem",
        }}
      >
        <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
          Cubao to Makati
        </p>
        <p className="text-xs mt-0.5" style={{ color: "var(--accent)" }}>
          P15 · 28 min
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: -24, y: 8 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ delay: 1.2, duration: 0.6, ease: "easeOut" }}
        className="absolute bottom-24 left-4 rounded-xl p-3 shadow-xl sm:-left-10"
        style={{
          background: "var(--card-surface)",
          border: "1px solid var(--card-border)",
          minWidth: "130px",
          maxWidth: "10rem",
        }}
      >
        <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
          MMDA Alert
        </p>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-sub)" }}>
          EDSA heavy traffic
        </p>
      </motion.div>
    </div>
  );
}

export default function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const y = useTransform(scrollYProgress, [0, 1], [0, 80]);
  const opacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

  return (
    <section
      ref={ref}
      className="hero-surface relative min-h-screen flex flex-col items-center justify-center overflow-hidden pt-20 pb-16 px-4"
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 40%, rgba(0,122,255,0.12) 0%, transparent 70%)",
        }}
      />

      <motion.div
        style={{ y, opacity }}
        className="relative z-10 max-w-5xl mx-auto w-full flex flex-col lg:flex-row items-center gap-12 lg:gap-16"
      >
        <div className="flex-1 text-center lg:text-left">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mb-6 flex justify-center lg:justify-start"
          >
            <div className="inline-flex flex-col items-center">
              <Image
                src="/sakai-hi.gif"
                alt="Sakai mascot waving"
                width={560}
                height={484}
                priority
                className="mb-2 h-auto w-28 sm:w-32 lg:w-36 drop-shadow-[0_20px_36px_rgba(0,0,0,0.26)]"
              />
              <span
                className="inline-block text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full"
                style={{
                  background: "rgba(0,122,255,0.12)",
                  color: "#007AFF",
                  border: "1px solid rgba(0,122,255,0.2)",
                }}
              >
                Metro Manila · Beta
              </span>
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight tracking-tight"
            style={{ color: "#F7FBFE", fontFamily: "var(--font-display)" }}
          >
            Where to <span style={{ color: "#007AFF" }}>Sakai</span> today?
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.35 }}
            className="mt-5 text-lg sm:text-xl max-w-md mx-auto lg:mx-0 leading-relaxed"
            style={{ color: "#A0B4C8" }}
          >
            Voice-first jeepney and transit planner for Metro Manila. Say where you&apos;re going
            {" "}and Sakai handles the rest.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="mt-8 flex flex-wrap items-center gap-3 justify-center lg:justify-start"
          >
            <a
              href="#"
              className="flex items-center gap-2.5 px-5 py-3 rounded-xl text-sm font-medium transition-opacity hover:opacity-80"
              style={{
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "#F7FBFE",
              }}
            >
              Download Now
            </a>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
          className="relative flex-shrink-0 w-full max-w-xs lg:max-w-sm"
        >
          <PhoneMockup />
        </motion.div>
      </motion.div>
    </section>
  );
}
