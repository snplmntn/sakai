"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { GuideSummary, VehicleGroup } from "@/lib/guides";
import { GuideCard } from "@/components/GuideCard";

interface GuidesExplorerProps {
  guides: GuideSummary[];
  vehicleGroups: VehicleGroup[];
}

export function GuidesExplorer({
  guides,
  vehicleGroups,
}: GuidesExplorerProps) {
  const [query, setQuery] = useState("");
  const [activeVehicle, setActiveVehicle] = useState("all");
  const deferredQuery = useDeferredValue(query);

  const filteredGuides = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();

    return guides.filter((guide) => {
      const matchesVehicle =
        activeVehicle === "all" || guide.vehicleType === activeVehicle;
      const matchesQuery =
        normalizedQuery.length === 0 ||
        guide.searchText.includes(normalizedQuery);

      return matchesVehicle && matchesQuery;
    });
  }, [activeVehicle, deferredQuery, guides]);

  return (
    <section className="space-y-6">
      <div className="card-surface rounded-3xl p-5 sm:p-6">
        <div className="flex flex-col gap-4">
          <label className="guide-search">
            <Search size={18} style={{ color: "var(--text-sub)" }} />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search jeepney, bus, fare tips, train cards..."
              aria-label="Search guides"
            />
          </label>
          <div className="guide-filters">
            <button
              type="button"
              onClick={() => setActiveVehicle("all")}
              className={`guide-filter-pill ${
                activeVehicle === "all" ? "guide-filter-pill-active" : ""
              }`}
            >
              All guides
            </button>
            {vehicleGroups.map((group) => (
              <button
                key={group.vehicleType}
                type="button"
                onClick={() => setActiveVehicle(group.vehicleType)}
                className={`guide-filter-pill ${
                  activeVehicle === group.vehicleType
                    ? "guide-filter-pill-active"
                    : ""
                }`}
              >
                {group.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filteredGuides.length > 0 ? (
        <div className="guide-grid">
          {filteredGuides.map((guide) => (
            <GuideCard key={guide.slug} guide={guide} />
          ))}
        </div>
      ) : (
        <div className="card-surface rounded-3xl p-8 text-center">
          <h2
            className="text-xl font-semibold"
            style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}
          >
            No guides matched that search
          </h2>
          <p className="mt-2 text-sm" style={{ color: "var(--text-sub)" }}>
            Try a vehicle name like Jeepney or Taxi, or clear the filters.
          </p>
          <Link href="/guides" className="inline-flex mt-4 text-sm font-medium accent-color">
            Reset guide search
          </Link>
        </div>
      )}
    </section>
  );
}
