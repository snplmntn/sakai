import { Router } from "express";

import areaUpdateRoutes from "./area-update.routes.js";
import authRoutes from "./auth.routes.js";
import healthRoutes from "./health.routes.js";
import meRoutes from "./me.routes.js";

const router = Router();

router.use("/area-updates", areaUpdateRoutes);
router.use("/auth", authRoutes);
router.use("/health", healthRoutes);
router.use("/me", meRoutes);

export default router;
