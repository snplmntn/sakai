export interface PSGCRegion {
  code: string;
  name: string;
  regionName: string | null;
}

export interface PSGCProvince {
  code: string;
  name: string;
  regionCode: string;
}

export interface PSGCCityMunicipality {
  code: string;
  name: string;
  regionCode: string;
  provinceCode: string | null;
  isCity: boolean;
  isMunicipality: boolean;
}

export interface PSGCBarangay {
  code: string;
  name: string;
}
