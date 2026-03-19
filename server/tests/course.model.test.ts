import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/config/supabase.js", () => ({
  getSupabaseAdminClient: vi.fn()
}));

import { getSupabaseAdminClient } from "../src/config/supabase.js";
import { HttpError } from "../src/types/http-error.js";
import {
  createCourse,
  getCourseById,
  listCourses
} from "../src/models/course.model.js";

const mockedGetSupabaseAdminClient = vi.mocked(getSupabaseAdminClient);

describe("course model", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps list results from Supabase", async () => {
    const order = vi.fn().mockResolvedValue({
      data: [
        {
          id: "514eb2eb-5e7d-4d6a-a5ad-d9d25cd71417",
          code: "CS101",
          title: "Intro to Sakai",
          description: "Starter course",
          created_at: "2026-03-19T00:00:00.000Z"
        }
      ],
      error: null
    });

    const client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order
        })
      })
    };

    mockedGetSupabaseAdminClient.mockReturnValue(client as never);

    const courses = await listCourses();

    expect(client.from).toHaveBeenCalledWith("courses");
    expect(courses).toEqual([
      {
        id: "514eb2eb-5e7d-4d6a-a5ad-d9d25cd71417",
        code: "CS101",
        title: "Intro to Sakai",
        description: "Starter course",
        createdAt: "2026-03-19T00:00:00.000Z"
      }
    ]);
  });

  it("returns null when a course is missing", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: null
    });

    const client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle
          })
        })
      })
    };

    mockedGetSupabaseAdminClient.mockReturnValue(client as never);

    const course = await getCourseById("514eb2eb-5e7d-4d6a-a5ad-d9d25cd71417");

    expect(course).toBeNull();
  });

  it("throws a HttpError when course creation fails", async () => {
    const single = vi.fn().mockResolvedValue({
      data: null,
      error: {
        message: "duplicate key value violates unique constraint"
      }
    });

    const client = {
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single
          })
        })
      })
    };

    mockedGetSupabaseAdminClient.mockReturnValue(client as never);

    await expect(
      createCourse({
        code: "CS101",
        title: "Intro to Sakai"
      })
    ).rejects.toBeInstanceOf(HttpError);
  });
});
