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
    <section id="how-it-works" ref={ref} style={{ height: "300vh" }}>
      <motion.div
        style={{
          position: "sticky",
          top: 0,
          height: "100vh",
          overflow: "hidden",
          backgroundColor,
        }}
      >
        <div className="h-full flex flex-col lg:flex-row items-center justify-center gap-12 lg:gap-20 px-4 sm:px-6 max-w-6xl mx-auto">
          {/* Left: giant step number */}
          <div className="flex-shrink-0 flex flex-col items-center lg:items-start">
            <p
              className="text-base sm:text-lg lg:text-xl uppercase tracking-[0.28em] mb-3"
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
                  fontSize: "clamp(8rem, 20vw, 18rem)",
                  fontWeight: 800,
                  lineHeight: 1,
                  color: "#007AFF",
                  opacity: 0.15,
                }}
              >
                {steps[activeStep].number}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Right: step content */}
          <div className="flex-1 relative" style={{ minHeight: "300px" }}>
            {steps.map((step, i) => (
              <motion.div
                key={step.number}
                style={{
                  position: "absolute",
                  inset: 0,
                  opacity: stepOpacities[i],
                  x: stepXs[i],
                }}
                className="flex flex-col justify-center"
              >
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6"
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
                    fontSize: "clamp(2rem, 5vw, 3.5rem)",
                    fontWeight: 700,
                    color: "#F7FBFE",
                    marginBottom: "1rem",
                  }}
                >
                  {step.title}
                </h3>
                <p
                  style={{
                    color: "#A0B4C8",
                    fontSize: "clamp(1rem, 1.5vw, 1.25rem)",
                    lineHeight: 1.6,
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
