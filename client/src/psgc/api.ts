import { requestData } from '../api/base';
import type { PSGCBarangay, PSGCCityMunicipality, PSGCProvince, PSGCRegion } from './types';

const parseString = (value: unknown, fieldName: string): string => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Expected ${fieldName} to be a non-empty string`);
  }

  return value;
};

const parseNullableString = (value: unknown): string | null => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  return value;
};

const parseFalseableString = (value: unknown): string | null =>
  value === false ? null : parseNullableString(value);

const parseArray = (value: unknown): unknown[] => {
  if (!Array.isArray(value)) {
    throw new Error('PSGC returned an unexpected response.');
  }

  return value;
};

const parseRegion = (value: unknown): PSGCRegion => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Invalid PSGC region');
  }

  const candidate = value as Record<string, unknown>;

  return {
    code: parseString(candidate.code, 'region.code'),
    name: parseString(candidate.name, 'region.name'),
    regionName: parseNullableString(candidate.regionName),
  };
};

const parseProvince = (value: unknown): PSGCProvince => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Invalid PSGC province');
  }

  const candidate = value as Record<string, unknown>;

  return {
    code: parseString(candidate.code, 'province.code'),
    name: parseString(candidate.name, 'province.name'),
    regionCode: parseString(candidate.regionCode, 'province.regionCode'),
  };
};

const parseCityMunicipality = (value: unknown): PSGCCityMunicipality => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Invalid PSGC city or municipality');
  }

  const candidate = value as Record<string, unknown>;

  return {
    code: parseString(candidate.code, 'cityMunicipality.code'),
    name: parseString(candidate.name, 'cityMunicipality.name'),
    regionCode: parseString(candidate.regionCode, 'cityMunicipality.regionCode'),
    provinceCode: parseFalseableString(candidate.provinceCode),
    isCity: candidate.isCity === true,
    isMunicipality: candidate.isMunicipality === true,
  };
};

const parseBarangay = (value: unknown): PSGCBarangay => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Invalid PSGC barangay');
  }

  const candidate = value as Record<string, unknown>;

  return {
    code: parseString(candidate.code, 'barangay.code'),
    name: parseString(candidate.name, 'barangay.name'),
  };
};

export const getPsgcRegionLabel = (region: PSGCRegion): string =>
  region.regionName && region.regionName.trim().length > 0 ? region.regionName : region.name;

export const getPsgcRegions = async (): Promise<PSGCRegion[]> =>
  requestData(
    {
      method: 'GET',
      path: '/api/psgc/regions',
    },
    (value) => parseArray(value).map(parseRegion)
  );

export const getPsgcProvincesByRegion = async (
  regionCode: string
): Promise<PSGCProvince[]> =>
  requestData(
    {
      method: 'GET',
      path: `/api/psgc/regions/${encodeURIComponent(regionCode)}/provinces`,
    },
    (value) => parseArray(value).map(parseProvince)
  );

export const getPsgcCitiesMunicipalitiesByRegion = async (
  regionCode: string
): Promise<PSGCCityMunicipality[]> =>
  requestData(
    {
      method: 'GET',
      path: `/api/psgc/regions/${encodeURIComponent(regionCode)}/cities-municipalities`,
    },
    (value) => parseArray(value).map(parseCityMunicipality)
  );

export const getPsgcCitiesMunicipalitiesByProvince = async (
  provinceCode: string
): Promise<PSGCCityMunicipality[]> =>
  requestData(
    {
      method: 'GET',
      path: `/api/psgc/provinces/${encodeURIComponent(provinceCode)}/cities-municipalities`,
    },
    (value) => parseArray(value).map(parseCityMunicipality)
  );

export const getPsgcBarangaysByCityMunicipality = async (
  cityMunicipalityCode: string
): Promise<PSGCBarangay[]> =>
  requestData(
    {
      method: 'GET',
      path: `/api/psgc/cities-municipalities/${encodeURIComponent(
        cityMunicipalityCode
      )}/barangays`,
    },
    (value) => parseArray(value).map(parseBarangay)
  );
