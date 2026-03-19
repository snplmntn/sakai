import { Router } from "express";

import * as courseController from "../controllers/course.controller.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  courseIdParamsSchema,
  createCourseSchema
} from "../schemas/course.schema.js";

const router = Router();

router.get("/", courseController.listCourses);
router.get("/:id", validate(courseIdParamsSchema, "params"), courseController.getCourseById);
router.post("/", validate(createCourseSchema), courseController.createCourse);

export default router;
