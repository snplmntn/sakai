import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Marquee from "@/components/Marquee";
import Features from "@/components/Features";
import RouteLine from "@/components/RouteLine";
import HowItWorks from "@/components/HowItWorks";
import Stats from "@/components/Stats";
import Download from "@/components/Download";
import Footer from "@/components/Footer";

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Marquee />
        <Features />
        <RouteLine />
        <HowItWorks />
        <Stats />
        <Download />
      </main>
      <Footer />
    </>
  );
}
