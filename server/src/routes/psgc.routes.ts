import { Router } from "express";

import * as psgcController from "../controllers/psgc.controller.js";

const router = Router();

router.get("/regions", psgcController.listRegions);
router.get("/regions/:regionCode/provinces", psgcController.listProvincesByRegion);
router.get(
  "/regions/:regionCode/cities-municipalities",
  psgcController.listCitiesMunicipalitiesByRegion
);
router.get(
  "/provinces/:provinceCode/cities-municipalities",
  psgcController.listCitiesMunicipalitiesByProvince
);
router.get(
  "/cities-municipalities/:cityMunicipalityCode/barangays",
  psgcController.listBarangaysByCityMunicipality
);

export default router;
