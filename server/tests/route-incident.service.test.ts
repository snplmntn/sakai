import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/models/area-update.model.js", () => ({
  listActiveAreaUpdates: vi.fn()
}));

vi.mock("../src/models/place.model.js", () => ({
  normalizePlaceSearchText: vi.fn((value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
  )
}));

import * as areaUpdateModel from "../src/models/area-update.model.js";
import { filterRelevantIncidents, listRelevantAreaUpdates } from "../src/services/route-incident.service.js";

const mockedAreaUpdateModel = vi.mocked(areaUpdateModel);

describe("route incident service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("filters and sorts relevant incidents by corridor and endpoint labels", async () => {
    mockedAreaUpdateModel.listActiveAreaUpdates.mockResolvedValue([
      {
        id: "incident-low",
        externalId: "mmda-low",
        source: "mmda",
        sourceUrl: "https://x.com/MMDA",
        alertType: "Stalled vehicle",
        location: "Cubao corridor",
        direction: "WB",
        involved: null,
        reportedTimeText: "5:10 PM",
        laneStatus: "One lane occupied",
        trafficStatus: null,
        severity: "low",
        summary: "Minor slowdown on the Cubao corridor.",
        corridorTags: ["cubao"],
        normalizedLocation: "cubao corridor",
        displayUntil: "2026-03-19T11:10:00.000Z",
        rawText: "MMDA ALERT...",
        scrapedAt: "2026-03-19T10:10:00.000Z",
        createdAt: "2026-03-19T10:10:00.000Z"
      },
      {
        id: "incident-high",
        externalId: "mmda-high",
        source: "mmda",
        sourceUrl: "https://x.com/MMDA",
        alertType: "Road crash incident",
        location: "Cubao corridor",
        direction: "EB",
        involved: "2 vehicles",
        reportedTimeText: "5:29 PM",
        laneStatus: "One lane occupied",
        trafficStatus: "MMDA enforcers are on site managing traffic",
        severity: "high",
        summary: "Major crash along the Cubao corridor may slow this route.",
        corridorTags: ["cubao"],
        normalizedLocation: "cubao corridor",
        displayUntil: "2026-03-19T15:05:00.000Z",
        rawText: "MMDA ALERT...",
        scrapedAt: "2026-03-19T10:05:00.000Z",
        createdAt: "2026-03-19T10:05:00.000Z"
      },
      {
        id: "incident-destination",
        externalId: "mmda-destination",
        source: "mmda",
        sourceUrl: "https://x.com/MMDA",
        alertType: "Road obstruction",
        location: "Pasay Rotonda",
        direction: null,
        involved: null,
        reportedTimeText: "5:00 PM",
        laneStatus: "Two lanes occupied",
        trafficStatus: null,
        severity: "medium",
        summary: "Obstruction near Pasay Rotonda may affect the final approach.",
        corridorTags: ["taft"],
        normalizedLocation: "pasay rotonda",
        displayUntil: "2026-03-19T13:00:00.000Z",
        rawText: "MMDA ALERT...",
        scrapedAt: "2026-03-19T10:00:00.000Z",
        createdAt: "2026-03-19T10:00:00.000Z"
      },
      {
        id: "incident-other",
        externalId: "mmda-other",
        source: "mmda",
        sourceUrl: "https://x.com/MMDA",
        alertType: "Road crash incident",
        location: "C5",
        direction: null,
        involved: null,
        reportedTimeText: "5:30 PM",
        laneStatus: null,
        trafficStatus: null,
        severity: "high",
        summary: "Unrelated incident.",
        corridorTags: ["c5"],
        normalizedLocation: "c5",
        displayUntil: "2026-03-19T15:30:00.000Z",
        rawText: "MMDA ALERT...",
        scrapedAt: "2026-03-19T10:30:00.000Z",
        createdAt: "2026-03-19T10:30:00.000Z"
      }
    ]);

    const incidents = await listRelevantAreaUpdates({
      corridorTags: ["cubao"],
      originLabel: "Cubao",
      destinationLabel: "Pasay Rotonda",
      limit: 3
    });

    expect(incidents.map((incident) => incident.id)).toEqual([
      "incident-high",
      "incident-destination",
      "incident-low"
    ]);
  });

  it("filters incidents without loading from the model", () => {
    const incidents = filterRelevantIncidents({
      incidents: [
        {
          id: "incident-1",
          externalId: "mmda-1",
          source: "mmda",
          sourceUrl: "https://x.com/MMDA",
          alertType: "Stalled truck",
          location: "Ortigas Avenue",
          direction: "WB",
          involved: null,
          reportedTimeText: "5:53 PM",
          laneStatus: "One lane occupied",
          trafficStatus: null,
          severity: "medium",
          summary: "Ortigas westbound lane is blocked.",
          corridorTags: ["ortigas"],
          normalizedLocation: "ortigas avenue",
          displayUntil: "2026-03-19T13:53:00.000Z",
          rawText: "MMDA ALERT...",
          scrapedAt: "2026-03-19T10:53:00.000Z",
          createdAt: "2026-03-19T10:53:00.000Z"
        }
      ],
      corridorTags: ["ortigas"],
      originLabel: "Megamall",
      destinationLabel: "Pasig",
      limit: 2
    });

    expect(incidents).toHaveLength(1);
    expect(incidents[0]).toMatchObject({
      id: "incident-1",
      alertType: "Stalled truck",
      severity: "medium"
    });
  });
});
