import type { RequestHandler } from "express";

import * as psgcService from "../services/psgc.service.js";

const readRouteParam = (value: string | string[]): string =>
  Array.isArray(value) ? value[0] ?? "" : value;

export const listRegions: RequestHandler = async (_req, res) => {
  const regions = await psgcService.listRegions();

  res.status(200).json({
    success: true,
    data: regions
  });
};

export const listProvincesByRegion: RequestHandler = async (req, res) => {
  const provinces = await psgcService.listProvincesByRegion(readRouteParam(req.params.regionCode));

  res.status(200).json({
    success: true,
    data: provinces
  });
};

export const listCitiesMunicipalitiesByRegion: RequestHandler = async (req, res) => {
  const citiesMunicipalities = await psgcService.listCitiesMunicipalitiesByRegion(
    readRouteParam(req.params.regionCode)
  );

  res.status(200).json({
    success: true,
    data: citiesMunicipalities
  });
};

export const listCitiesMunicipalitiesByProvince: RequestHandler = async (req, res) => {
  const citiesMunicipalities = await psgcService.listCitiesMunicipalitiesByProvince(
    readRouteParam(req.params.provinceCode)
  );

  res.status(200).json({
    success: true,
    data: citiesMunicipalities
  });
};

export const listBarangaysByCityMunicipality: RequestHandler = async (req, res) => {
  const barangays = await psgcService.listBarangaysByCityMunicipality(
    readRouteParam(req.params.cityMunicipalityCode)
  );

  res.status(200).json({
    success: true,
    data: barangays
  });
};
