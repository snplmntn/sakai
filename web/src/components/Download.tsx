"use client";

import { motion } from "framer-motion";

function StoreBadge({
  platform,
  href,
}: {
  platform: "apple" | "google";
  href: string;
}) {
  return (
    <a
      href={href}
      className="flex items-center gap-2.5 px-5 py-3 rounded-xl text-sm font-medium transition-opacity hover:opacity-80"
      style={{
        background: "rgba(255,255,255,0.1)",
        border: "1px solid rgba(255,255,255,0.18)",
        color: "#F7FBFE",
      }}
    >
      {platform === "apple" ? (
        <>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
          </svg>
          App Store
        </>
      ) : (
        <>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3.18 23.76c.3.17.64.22.99.14l12.12-6.99-2.69-2.7-10.42 9.55zm-1.7-20.1A1.98 1.98 0 0 0 1 5.08v13.84c0 .67.32 1.27.86 1.64l.1.06 7.75-7.75v-.18L1.48 3.66l-.01.01zM20.47 10.5l-2.6-1.5-3.01 3.01 3.01 3.01 2.62-1.51c.75-.43.75-1.58-.02-2.01zm-17.29 12.3l10.42-10.42L10.91 9.7.09.86 3.18 23.76" />
          </svg>
          Google Play
        </>
      )}
    </a>
  );
}

export default function Download() {
  return (
    <section
      id="download"
      className="relative py-24 px-4 sm:px-6 overflow-hidden"
      style={{ background: "#102033" }}
    >
      {/* Radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 50% 50%, rgba(0,122,255,0.18) 0%, transparent 65%)",
        }}
      />

      <div className="relative z-10 max-w-2xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <span
            className="inline-block text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full mb-6"
            style={{
              background: "rgba(0,122,255,0.15)",
              color: "#007AFF",
              border: "1px solid rgba(0,122,255,0.25)",
            }}
          >
            Free Download
          </span>

          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4" style={{ color: "#F7FBFE" }}>
            Get Sakai Free
          </h2>

          <p className="text-base sm:text-lg mb-10" style={{ color: "#A0B4C8" }}>
            Available on iOS and Android. No sign-up required to start planning your commute.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <StoreBadge platform="apple" href="#" />
            <StoreBadge platform="google" href="#" />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
