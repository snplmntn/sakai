import Footer from "@/components/Footer";
import { GuidesExplorer } from "@/components/GuidesExplorer";
import Navbar from "@/components/Navbar";
import { getAllGuides, getVehicleGroups } from "@/lib/guides";

export default function GuidesPage() {
  const guides = getAllGuides();
  const vehicleGroups = getVehicleGroups();

  return (
    <>
      <Navbar />
      <main className="px-4 pt-28 pb-16 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <section className="guide-hero card-surface rounded-[32px] p-6 sm:p-8 lg:p-10">
            <div className="guide-hero-copy">
              <span className="guide-hero-kicker">Commuting Guides</span>
              <h1 className="guide-hero-title">
                Find practical ride instructions by vehicle type.
              </h1>
              <p className="guide-hero-text">
                Browse walking, jeepney, train, bus, tricycle, FX, taxi, and
                e-jeep guides sourced from the shared Sakai guide document.
              </p>
            </div>
            <div className="guide-hero-stats">
              <div className="guide-stat-pill">
                <strong>{guides.length}</strong>
                <span>guide pages</span>
              </div>
              <div className="guide-stat-pill">
                <strong>{vehicleGroups.length}</strong>
                <span>vehicle types</span>
              </div>
            </div>
          </section>

          <section className="mt-8">
            <GuidesExplorer guides={guides} vehicleGroups={vehicleGroups} />
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
