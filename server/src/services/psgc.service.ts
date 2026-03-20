import { HttpError } from "../types/http-error.js";

const PSGC_API_BASE_URL = "https://psgc.gitlab.io/api";

const fetchPsgcCollection = async (path: string): Promise<unknown[]> => {
  let response: Response;

  try {
    response = await fetch(`${PSGC_API_BASE_URL}${path}`, {
      headers: {
        Accept: "application/json"
      }
    });
  } catch (error) {
    throw new HttpError(
      502,
      error instanceof Error && error.message.trim().length > 0
        ? error.message
        : "Failed to reach PSGC"
    );
  }

  if (!response.ok) {
    throw new HttpError(502, "PSGC is unavailable right now");
  }

  const body = (await response.json()) as unknown;

  if (!Array.isArray(body)) {
    throw new HttpError(502, "PSGC returned an unexpected response");
  }

  return body;
};

export const listRegions = async (): Promise<unknown[]> => fetchPsgcCollection("/regions/");

export const listProvincesByRegion = async (regionCode: string): Promise<unknown[]> =>
  fetchPsgcCollection(`/regions/${encodeURIComponent(regionCode)}/provinces/`);

export const listCitiesMunicipalitiesByRegion = async (
  regionCode: string
): Promise<unknown[]> =>
  fetchPsgcCollection(`/regions/${encodeURIComponent(regionCode)}/cities-municipalities/`);

export const listCitiesMunicipalitiesByProvince = async (
  provinceCode: string
): Promise<unknown[]> =>
  fetchPsgcCollection(
    `/provinces/${encodeURIComponent(provinceCode)}/cities-municipalities/`
  );

export const listBarangaysByCityMunicipality = async (
  cityMunicipalityCode: string
): Promise<unknown[]> =>
  fetchPsgcCollection(
    `/cities-municipalities/${encodeURIComponent(cityMunicipalityCode)}/barangays/`
  );
