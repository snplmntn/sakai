import { getSupabaseAdminClient } from "../config/supabase.js";
import { HttpError } from "../types/http-error.js";
import type { Database } from "../types/database.js";

type CourseRow = Database["public"]["Tables"]["courses"]["Row"];
type CourseInsert = Database["public"]["Tables"]["courses"]["Insert"];

export interface Course {
  id: string;
  code: string;
  title: string;
  description: string | null;
  createdAt: string;
}

export interface CreateCourseInput {
  code: string;
  title: string;
  description?: string;
}

const mapCourse = (course: CourseRow): Course => ({
  id: course.id,
  code: course.code,
  title: course.title,
  description: course.description,
  createdAt: course.created_at
});

export const listCourses = async (): Promise<Course[]> => {
  const client = getSupabaseAdminClient();
  const { data, error } = await client
    .from("courses")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new HttpError(500, `Failed to fetch courses: ${error.message}`);
  }

  const rows = (data ?? []) as CourseRow[];

  return rows.map(mapCourse);
};

export const getCourseById = async (id: string): Promise<Course | null> => {
  const client = getSupabaseAdminClient();
  const { data, error } = await client
    .from("courses")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new HttpError(500, `Failed to fetch course: ${error.message}`);
  }

  const row = data as CourseRow | null;

  return row ? mapCourse(row) : null;
};

export const createCourse = async (
  payload: CreateCourseInput
): Promise<Course> => {
  const client = getSupabaseAdminClient();
  const courseToInsert: CourseInsert = {
    code: payload.code,
    title: payload.title,
    description: payload.description ?? null
  };

  const { data, error } = await client
    .from("courses")
    .insert(courseToInsert)
    .select("*")
    .single();

  if (error || !data) {
    throw new HttpError(500, `Failed to create course: ${error?.message ?? "Unknown error"}`);
  }

  return mapCourse(data as CourseRow);
};
