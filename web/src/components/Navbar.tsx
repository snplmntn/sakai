"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import ThemeToggle from "./ThemeToggle";
import Image from "next/image";
import Link from "next/link";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.nav
      initial={{ y: -64, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? "navbar-glass shadow-sm" : "bg-transparent"
      }`}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Wordmark */}
        <a href="#" className="flex items-center gap-2">
          <Image
            src="/icon.png"
            alt="Sakai icon"
            width={28}
            height={28}
            className="rounded-md"
          />
          <span
            className="text-lg font-semibold tracking-tight"
            style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}
          >
            Sakai
          </span>
        </a>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          <Link
            href="/guides"
            className="text-sm font-medium px-4 py-2 rounded-full transition-opacity hover:opacity-80"
            style={{
              color: "var(--text-primary)",
              border: "1px solid var(--card-border)",
              background: "rgba(255,255,255,0.5)",
            }}
          >
            Guides
          </Link>
          <ThemeToggle />
          <a
            href="#download"
            className="btn-primary text-sm font-medium px-4 py-2 rounded-full transition-opacity hover:opacity-80"
          >
            Download App
          </a>
        </div>
      </div>
    </motion.nav>
  );
}
