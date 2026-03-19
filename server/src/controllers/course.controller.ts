import type { RequestHandler } from "express";

import { HttpError } from "../types/http-error.js";
import * as courseModel from "../models/course.model.js";

export const listCourses: RequestHandler = async (_req, res) => {
  const courses = await courseModel.listCourses();

  res.status(200).json({
    success: true,
    data: courses
  });
};

export const getCourseById: RequestHandler = async (req, res) => {
  const courseId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const course = await courseModel.getCourseById(courseId);

  if (!course) {
    throw new HttpError(404, `Course ${courseId} not found`);
  }

  res.status(200).json({
    success: true,
    data: course
  });
};

export const createCourse: RequestHandler = async (req, res) => {
  const course = await courseModel.createCourse(req.body);

  res.status(201).json({
    success: true,
    data: course
  });
};
