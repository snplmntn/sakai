import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/config/supabase.js", () => ({
  getSupabaseAdminClient: vi.fn()
}));

import { getSupabaseAdminClient } from "../src/config/supabase.js";
import {
  listAreaUpdates,
  upsertAreaUpdates
} from "../src/models/area-update.model.js";

const mockedGetSupabaseAdminClient = vi.mocked(getSupabaseAdminClient);

describe("area update model", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps area updates from Supabase", async () => {
    const limit = vi.fn().mockResolvedValue({
      data: [
        {
          id: "514eb2eb-5e7d-4d6a-a5ad-d9d25cd71417",
          external_id: "hash-1",
          source: "mmda",
          source_url: "https://x.com/MMDA",
          alert_type: "Road crash incident",
          location: "Roxas Blvd EDSA after flyover",
          direction: "SB",
          involved: "2 motorcycles",
          reported_time_text: "5:29 PM",
          lane_status: "One lane occupied",
          traffic_status: "MMDA enforcers are on site managing traffic",
          raw_text:
            "MMDA ALERT: Road crash incident at Roxas Blvd EDSA after flyover SB involving 2 motorcycles as of 5:29 PM. One lane occupied. MMDA enforcers are on site managing traffic. #mmda",
          scraped_at: "2026-03-19T10:05:00.000Z",
          created_at: "2026-03-19T10:05:00.000Z"
        }
      ],
      error: null
    });
    const order = vi.fn().mockReturnValue({
      limit
    });
    const ilike = vi.fn().mockReturnValue({
      order
    });
    const select = vi.fn().mockReturnValue({
      ilike,
      order
    });
    const client = {
      from: vi.fn().mockReturnValue({
        select
      })
    };

    mockedGetSupabaseAdminClient.mockReturnValue(client as never);

    const updates = await listAreaUpdates({
      area: "Roxas",
      limit: 5
    });

    expect(client.from).toHaveBeenCalledWith("area_updates");
    expect(ilike).toHaveBeenCalledWith("location", "%Roxas%");
    expect(updates).toEqual([
      {
        id: "514eb2eb-5e7d-4d6a-a5ad-d9d25cd71417",
        externalId: "hash-1",
        source: "mmda",
        sourceUrl: "https://x.com/MMDA",
        alertType: "Road crash incident",
        location: "Roxas Blvd EDSA after flyover",
        direction: "SB",
        involved: "2 motorcycles",
        reportedTimeText: "5:29 PM",
        laneStatus: "One lane occupied",
        trafficStatus: "MMDA enforcers are on site managing traffic",
        rawText:
          "MMDA ALERT: Road crash incident at Roxas Blvd EDSA after flyover SB involving 2 motorcycles as of 5:29 PM. One lane occupied. MMDA enforcers are on site managing traffic. #mmda",
        scrapedAt: "2026-03-19T10:05:00.000Z",
        createdAt: "2026-03-19T10:05:00.000Z"
      }
    ]);
  });

  it("upserts area updates with external_id conflict handling", async () => {
    const select = vi.fn().mockResolvedValue({
      data: [
        {
          id: "514eb2eb-5e7d-4d6a-a5ad-d9d25cd71417",
          external_id: "hash-1",
          source: "mmda",
          source_url: "https://x.com/MMDA",
          alert_type: "Stalled truck due to mechanical trouble",
          location: "Ortigas Avenue before EDSA intersection",
          direction: "WB",
          involved: null,
          reported_time_text: "5:53 PM",
          lane_status: "One lane occupied",
          traffic_status: "MMDA enforcers are on site managing traffic",
          raw_text:
            "MMDA ALERT: Stalled truck due to mechanical trouble at Ortigas Avenue before EDSA intersection WB as of 5:53 PM. One lane occupied. MMDA enforcers are on site managing traffic. #mmda",
          scraped_at: "2026-03-19T10:05:00.000Z",
          created_at: "2026-03-19T10:05:00.000Z"
        }
      ],
      error: null
    });
    const upsert = vi.fn().mockReturnValue({
      select
    });
    const client = {
      from: vi.fn().mockReturnValue({
        upsert
      })
    };

    mockedGetSupabaseAdminClient.mockReturnValue(client as never);

    const updates = await upsertAreaUpdates([
      {
        externalId: "hash-1",
        source: "mmda",
        sourceUrl: "https://x.com/MMDA",
        alertType: "Stalled truck due to mechanical trouble",
        location: "Ortigas Avenue before EDSA intersection",
        direction: "WB",
        rawText:
          "MMDA ALERT: Stalled truck due to mechanical trouble at Ortigas Avenue before EDSA intersection WB as of 5:53 PM. One lane occupied. MMDA enforcers are on site managing traffic. #mmda",
        reportedTimeText: "5:53 PM",
        laneStatus: "One lane occupied",
        trafficStatus: "MMDA enforcers are on site managing traffic",
        scrapedAt: "2026-03-19T10:05:00.000Z"
      }
    ]);

    expect(upsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          external_id: "hash-1",
          alert_type: "Stalled truck due to mechanical trouble",
          direction: "WB"
        })
      ],
      {
        onConflict: "external_id"
      }
    );
    expect(updates).toHaveLength(1);
  });
});
