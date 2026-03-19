import Footer from "@/components/Footer";
import { GuidesExplorer } from "@/components/GuidesExplorer";
import Navbar from "@/components/Navbar";
import { getAllGuides, getVehicleGroups } from "@/lib/guides";

export const dynamic = "force-dynamic";

export default function GuidesPage() {
  const guides = getAllGuides();
  const vehicleGroups = getVehicleGroups();

  return (
    <>
      <Navbar />
      <main className="px-4 pt-28 pb-16 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <section className="guide-hero">
            <div className="guide-hero-copy">
              <span className="guide-hero-kicker">Commuting Guides</span>
              <h1 className="guide-hero-title">
                Practical commuting guides for everyday rides.
              </h1>
              <p className="guide-hero-text">
                Browse practical guide pages for walking, jeepneys, trains,
                buses, tricycles, FX, taxis, and e-jeeps using Sakai&apos;s
                shared reference content.
              </p>
              <div className="guide-hero-meta">
                <div className="guide-meta-chip">
                  <strong>{guides.length}</strong>
                  <span>guide pages</span>
                </div>
                <div className="guide-meta-chip">
                  <strong>{vehicleGroups.length}</strong>
                  <span>vehicle types</span>
                </div>
                <div className="guide-meta-chip guide-meta-chip-note">
                  <span>
                    Built for quick scanning, mobile reading, and first-time
                    commuters.
                  </span>
                </div>
              </div>
            </div>
          </section>

          <section className="mt-8">
            <GuidesExplorer guides={guides} />
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
