"use client";

import { useRef, useState } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useMotionValueEvent,
  AnimatePresence,
} from "framer-motion";
import { Mic, Map, Navigation } from "lucide-react";

const steps = [
  {
    number: "01",
    icon: <Mic size={28} />,
    title: "Speak",
    description:
      "Tell Sakai where you want to go. Use a landmark, barangay name, or just describe it.",
  },
  {
    number: "02",
    icon: <Map size={28} />,
    title: "Plan",
    description:
      "Sakai finds the best jeepney and transit combination with fare, time, and transfer details.",
  },
  {
    number: "03",
    icon: <Navigation size={28} />,
    title: "Go",
    description:
      "Follow turn-by-turn guidance with live MMDA alerts to arrive without guesswork.",
  },
] as const;

export default function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null);
  const [activeStep, setActiveStep] = useState(0);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    setActiveStep(v < 0.33 ? 0 : v < 0.66 ? 1 : 2);
  });

  const backgroundColor = useTransform(
    scrollYProgress,
    [0, 0.33, 0.66, 1],
    ["#0a1929", "#0d1f35", "#102033", "#102033"],
  );

  // Step 0 transforms
  const step0Opacity = useTransform(scrollYProgress, [0, 0.25, 0.33, 0.38], [1, 1, 0.5, 0]);
  const step0X = useTransform(scrollYProgress, [0.33, 0.38], [0, -60]);

  // Step 1 transforms
  const step1Opacity = useTransform(scrollYProgress, [0.28, 0.33, 0.58, 0.66], [0, 1, 1, 0]);
  const step1X = useTransform(scrollYProgress, [0.28, 0.33, 0.58, 0.66], [60, 0, 0, -60]);

  // Step 2 transforms
  const step2Opacity = useTransform(scrollYProgress, [0.61, 0.66, 1], [0, 1, 1]);
  const step2X = useTransform(scrollYProgress, [0.61, 0.66], [60, 0]);

  const stepOpacities = [step0Opacity, step1Opacity, step2Opacity];
  const stepXs = [step0X, step1X, step2X];

  return (
    <section id="how-it-works" ref={ref} className="bg-[#102033] lg:h-[300vh]">
      <div className="px-4 py-10 sm:px-6 sm:py-12 lg:hidden">
        <div className="mx-auto max-w-xl">
          <p
            className="mb-8 text-center text-sm uppercase tracking-[0.22em]"
            style={{ color: "#007AFF", fontFamily: "var(--font-mono)" }}
          >
            How It Works
          </p>

          <div className="space-y-6">
            {steps.map((step) => (
              <div key={step.number} className="rounded-[28px] border border-[var(--card-border)] bg-[#13253a] p-5">
                <div
                  className="text-center"
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "clamp(4rem, 22vw, 6rem)",
                    fontWeight: 800,
                    lineHeight: 0.9,
                    color: "#007AFF",
                    opacity: 0.18,
                  }}
                >
                  {step.number}
                </div>
                <div
                  className="mb-3 mt-2 flex h-12 w-12 items-center justify-center rounded-2xl mx-auto"
                  style={{
                    background: "#007AFF",
                    color: "#ffffff",
                    boxShadow: "0 4px 24px rgba(0,122,255,0.3)",
                  }}
                >
                  {step.icon}
                </div>
                <h3
                  className="text-center"
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "clamp(1.9rem, 7vw, 2.4rem)",
                    fontWeight: 700,
                    color: "#F7FBFE",
                    marginBottom: "0.5rem",
                  }}
                >
                  {step.title}
                </h3>
                <p
                  style={{
                    color: "#A0B4C8",
                    fontSize: "1rem",
                    lineHeight: 1.55,
                  }}
                >
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <motion.div
        className="relative hidden overflow-hidden lg:sticky lg:top-16 lg:block lg:h-[calc(100vh-4rem)]"
        style={{
          backgroundColor,
        }}
      >
        <div className="mx-auto grid h-full max-w-7xl grid-cols-1 content-start items-start justify-center gap-2 px-4 py-6 sm:gap-4 sm:px-6 sm:py-8 lg:grid-cols-[minmax(0,38rem)_minmax(0,30rem)] lg:content-center lg:items-center lg:gap-10 lg:px-8 lg:py-6">
          {/* Left: giant step number */}
          <div className="flex flex-col items-center lg:w-[38rem] lg:items-start">
            <p
              className="mb-2 text-sm uppercase tracking-[0.22em] sm:mb-3 sm:text-lg lg:text-xl lg:tracking-[0.28em]"
              style={{ color: "#007AFF", fontFamily: "var(--font-mono)" }}
            >
              How It Works
            </p>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeStep}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.25 }}
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(5.25rem, 28vw, 13rem)",
                  fontWeight: 800,
                  lineHeight: 0.9,
                  color: "#007AFF",
                  opacity: 0.15,
                }}
              >
                {steps[activeStep].number}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Right: step content */}
          <div className="relative w-full lg:w-[30rem]" style={{ minHeight: "180px" }}>
            {steps.map((step, i) => (
              <motion.div
                key={step.number}
                style={{
                  position: "absolute",
                  inset: 0,
                  opacity: stepOpacities[i],
                  x: stepXs[i],
                }}
                className="flex w-full flex-col justify-start lg:justify-center"
              >
                <div
                  className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl sm:mb-5 sm:h-14 sm:w-14"
                  style={{
                    background: "#007AFF",
                    color: "#ffffff",
                    boxShadow: "0 4px 24px rgba(0,122,255,0.3)",
                  }}
                >
                  {step.icon}
                </div>
                <h3
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "clamp(1.8rem, 7vw, 3.5rem)",
                    fontWeight: 700,
                    color: "#F7FBFE",
                    marginBottom: "0.5rem",
                  }}
                >
                  {step.title}
                </h3>
                <p
                  style={{
                    color: "#A0B4C8",
                    fontSize: "clamp(1rem, 3.8vw, 1.25rem)",
                    lineHeight: 1.5,
                    maxWidth: "480px",
                  }}
                >
                  {step.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>
    </section>
  );
}
