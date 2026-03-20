import { Router } from "express";

import areaUpdateRoutes from "./area-update.routes.js";
import authRoutes from "./auth.routes.js";
import communityRoutes from "./community.routes.js";
import healthRoutes from "./health.routes.js";
import meRoutes from "./me.routes.js";
import placeRoutes from "./place.routes.js";
import psgcRoutes from "./psgc.routes.js";
import routeRoutes from "./route.routes.js";
import speechRoutes from "./speech.routes.js";

const router = Router();

router.use("/area-updates", areaUpdateRoutes);
router.use("/auth", authRoutes);
router.use("/community", communityRoutes);
router.use("/health", healthRoutes);
router.use("/me", meRoutes);
router.use("/places", placeRoutes);
router.use("/psgc", psgcRoutes);
router.use("/routes", routeRoutes);
router.use("/speech", speechRoutes);

export default router;
