import { Router } from "express";

import areaUpdateRoutes from "./area-update.routes.js";
import authRoutes from "./auth.routes.js";
import healthRoutes from "./health.routes.js";
import meRoutes from "./me.routes.js";
import routeRoutes from "./route.routes.js";

const router = Router();

router.use("/area-updates", areaUpdateRoutes);
router.use("/auth", authRoutes);
router.use("/health", healthRoutes);
router.use("/me", meRoutes);
router.use("/routes", routeRoutes);

export default router;
