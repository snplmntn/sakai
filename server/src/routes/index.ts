import { Router } from "express";

import courseRoutes from "./course.routes.js";
import healthRoutes from "./health.routes.js";

const router = Router();

router.use("/health", healthRoutes);
router.use("/courses", courseRoutes);

export default router;
