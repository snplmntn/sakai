import { Router } from "express";

import areaUpdateRoutes from "./area-update.routes.js";
import authRoutes from "./auth.routes.js";
import courseRoutes from "./course.routes.js";
import healthRoutes from "./health.routes.js";

const router = Router();

router.use("/area-updates", areaUpdateRoutes);
router.use("/auth", authRoutes);
router.use("/health", healthRoutes);
router.use("/courses", courseRoutes);

export default router;
