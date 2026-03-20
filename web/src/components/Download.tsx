"use client";

import { motion } from "framer-motion";

export default function Download() {
  return (
    <section
      id="download"
      className="relative min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 overflow-hidden"
      style={{ background: "#102033" }}
    >
      {/* Radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 90% 80% at 50% 50%, rgba(0,122,255,0.18) 0%, transparent 65%)",
        }}
      />

      <div className="relative z-10 max-w-2xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.96 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true }}
          transition={{ type: "spring", stiffness: 100, damping: 20 }}
        >
          <span
            className="inline-block text-xs uppercase tracking-widest px-3 py-1 rounded-full mb-8"
            style={{
              fontFamily: "var(--font-impact)",
              fontWeight: 600,
              background: "rgba(0,122,255,0.15)",
              color: "#007AFF",
              border: "1px solid rgba(0,122,255,0.25)",
            }}
          >
            Free Download
          </span>

          <h2
            style={{
              fontFamily: "var(--font-impact)",
              fontSize: "clamp(3rem, 10vw, 7rem)",
              fontWeight: 700,
              lineHeight: 1.05,
              color: "#F7FBFE",
              marginBottom: "0.25rem",
              letterSpacing: "-0.02em",
            }}
          >
            Get Sakai.
          </h2>
          <h2
            style={{
              fontFamily: "var(--font-impact)",
              fontSize: "clamp(3rem, 10vw, 7rem)",
              fontWeight: 700,
              lineHeight: 1.05,
              color: "#007AFF",
              marginBottom: "2rem",
              letterSpacing: "-0.02em",
            }}
          >
            Commute smarter.
          </h2>

          <p className="text-base sm:text-lg mb-10" style={{ color: "#A0B4C8" }}>
            No sign-up required to start planning your commute.
          </p>

          <motion.a
            href="#"
            whileHover={{ y: -4 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-medium"
            style={{
              background: "#000000",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "#F7FBFE",
            }}
          >
            Download Now
          </motion.a>
        </motion.div>
      </div>
    </section>
  );
}
