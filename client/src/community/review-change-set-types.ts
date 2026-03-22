export type CommunityProposalType =
  | 'route_create'
  | 'route_update'
  | 'route_deprecate'
  | 'route_reactivate'
  | 'stop_correction'
  | 'transfer_correction'
  | 'fare_update'
  | 'route_note';

export type CommunityRouteMode = 'jeepney' | 'uv' | 'mrt3' | 'lrt1' | 'lrt2' | 'bus' | 'car';
export type CommunityFareMode = 'jeepney' | 'uv' | 'mrt3' | 'lrt1' | 'lrt2' | 'bus';
export type CommunityFareTrustLevel = 'official' | 'estimated' | 'partially_estimated';

export interface CommunityRouteRecord {
  code: string;
  displayName?: string;
  primaryMode?: CommunityRouteMode;
  operatorName?: string;
  sourceName?: string;
  sourceUrl?: string;
}

export interface CommunityRouteUpdateRecord {
  displayName?: string;
  operatorName?: string;
  sourceName?: string;
  sourceUrl?: string;
}

export interface CommunityRouteVariantRecord {
  code: string;
  displayName?: string;
  directionLabel?: string;
  originPlaceId?: string;
  destinationPlaceId?: string;
}

export interface CommunityRouteLeg {
  sequence: number;
  mode: CommunityRouteMode;
  fromStopId: string;
  toStopId: string;
  routeLabel?: string;
  distanceKm: number;
  durationMinutes: number;
  fareProductCode?: string;
  corridorTag?: string;
}

export interface CommunityRouteCreateChangeSet {
  route: CommunityRouteRecord;
  variant: CommunityRouteVariantRecord;
  legs: CommunityRouteLeg[];
}

export interface CommunityRouteUpdateChangeSet {
  route?: CommunityRouteUpdateRecord;
  variant: CommunityRouteVariantRecord;
  legs: CommunityRouteLeg[];
}

export interface CommunityStopCorrectionChangeSet {
  stopId?: string;
  stopName?: string;
  externalStopCode?: string;
  area?: string;
  latitude?: number;
  longitude?: number;
  placeId?: string;
  isActive?: boolean;
}

export interface CommunityTransferCorrectionChangeSet {
  transferPointId?: string;
  fromStopId?: string;
  toStopId?: string;
  walkingDistanceM?: number;
  walkingDurationMinutes?: number;
  isAccessible?: boolean;
}

export interface CommunityFareRuleVersionChangeSet {
  mode: CommunityFareMode;
  versionName?: string;
  sourceName?: string;
  sourceUrl?: string;
  effectivityDate?: string;
  verifiedAt?: string;
  trustLevel?: CommunityFareTrustLevel;
}

export interface CommunityFareProductChangeSet {
  productCode: string;
  mode?: CommunityFareMode;
  pricingStrategy: string;
  vehicleClass: string;
  minimumDistanceKm: number;
  minimumFareRegular: number;
  minimumFareDiscounted?: number;
  succeedingDistanceKm: number;
  succeedingFareRegular: number;
  succeedingFareDiscounted?: number;
  notes?: string;
}

export interface CommunityTrainStationFareChangeSet {
  originStopId: string;
  destinationStopId: string;
  regularFare: number;
  discountedFare: number;
}

export interface CommunityFareUpdateChangeSet {
  ruleVersion: CommunityFareRuleVersionChangeSet;
  activateVersion?: boolean;
  fareProducts?: CommunityFareProductChangeSet[];
  trainStationFares?: CommunityTrainStationFareChangeSet[];
}

export type CommunityReviewedChangeSet =
  | CommunityRouteCreateChangeSet
  | CommunityRouteUpdateChangeSet
  | CommunityStopCorrectionChangeSet
  | CommunityTransferCorrectionChangeSet
  | CommunityFareUpdateChangeSet
  | Record<string, never>;

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;

const asNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const asBoolean = (value: unknown): boolean | undefined =>
  typeof value === 'boolean' ? value : undefined;

const asRouteMode = (value: unknown): CommunityRouteMode =>
  value === 'uv' ||
  value === 'mrt3' ||
  value === 'lrt1' ||
  value === 'lrt2' ||
  value === 'bus' ||
  value === 'car'
    ? value
    : 'jeepney';

const asFareMode = (value: unknown): CommunityFareMode =>
  value === 'uv' ||
  value === 'mrt3' ||
  value === 'lrt1' ||
  value === 'lrt2' ||
  value === 'bus'
    ? value
    : 'jeepney';

const asFareTrustLevel = (value: unknown): CommunityFareTrustLevel | undefined =>
  value === 'official' || value === 'estimated' || value === 'partially_estimated'
    ? value
    : undefined;

export const createEmptyRouteLeg = (sequence = 0): CommunityRouteLeg => ({
  sequence,
  mode: 'jeepney',
  fromStopId: '',
  toStopId: '',
  routeLabel: '',
  distanceKm: 0,
  durationMinutes: 0,
  fareProductCode: '',
  corridorTag: '',
});

export const createEmptyFareProduct = (): CommunityFareProductChangeSet => ({
  productCode: '',
  mode: 'jeepney',
  pricingStrategy: 'minimum_plus_succeeding',
  vehicleClass: 'standard',
  minimumDistanceKm: 0,
  minimumFareRegular: 0,
  succeedingDistanceKm: 1,
  succeedingFareRegular: 0,
});

export const createEmptyTrainStationFare = (): CommunityTrainStationFareChangeSet => ({
  originStopId: '',
  destinationStopId: '',
  regularFare: 0,
  discountedFare: 0,
});

export const createEmptyReviewedChangeSet = (
  proposalType: CommunityProposalType
): CommunityReviewedChangeSet => {
  switch (proposalType) {
    case 'route_create':
      return {
        route: {
          code: '',
          displayName: '',
          primaryMode: 'jeepney',
          operatorName: '',
          sourceName: '',
          sourceUrl: '',
        },
        variant: {
          code: '',
          displayName: '',
          directionLabel: '',
          originPlaceId: '',
          destinationPlaceId: '',
        },
        legs: [createEmptyRouteLeg(0)],
      };
    case 'route_update':
      return {
        route: {
          displayName: '',
          operatorName: '',
          sourceName: '',
          sourceUrl: '',
        },
        variant: {
          code: '',
          displayName: '',
          directionLabel: '',
          originPlaceId: '',
          destinationPlaceId: '',
        },
        legs: [createEmptyRouteLeg(0)],
      };
    case 'stop_correction':
      return {
        stopId: '',
        stopName: '',
        externalStopCode: '',
        area: '',
        placeId: '',
      };
    case 'transfer_correction':
      return {
        transferPointId: '',
        fromStopId: '',
        toStopId: '',
        walkingDistanceM: 0,
        walkingDurationMinutes: 0,
        isAccessible: true,
      };
    case 'fare_update':
      return {
        ruleVersion: {
          mode: 'jeepney',
          versionName: '',
          sourceName: '',
          sourceUrl: '',
          effectivityDate: '',
          verifiedAt: '',
        },
        activateVersion: true,
        fareProducts: [createEmptyFareProduct()],
        trainStationFares: [],
      };
    default:
      return {};
  }
};

export const coerceReviewedChangeSet = (
  proposalType: CommunityProposalType,
  value: unknown
): CommunityReviewedChangeSet => {
  const record = asRecord(value) ?? {};

  switch (proposalType) {
    case 'route_create': {
      const route = asRecord(record.route) ?? {};
      const variant = asRecord(record.variant) ?? {};
      const legs = Array.isArray(record.legs) ? record.legs : [];

      return {
        route: {
          code: asString(route.code) ?? '',
          displayName: asString(route.displayName) ?? '',
          primaryMode: asRouteMode(route.primaryMode),
          operatorName: asString(route.operatorName) ?? '',
          sourceName: asString(route.sourceName) ?? '',
          sourceUrl: asString(route.sourceUrl) ?? '',
        },
        variant: {
          code: asString(variant.code) ?? '',
          displayName: asString(variant.displayName) ?? '',
          directionLabel: asString(variant.directionLabel) ?? '',
          originPlaceId: asString(variant.originPlaceId) ?? '',
          destinationPlaceId: asString(variant.destinationPlaceId) ?? '',
        },
        legs: legs.length > 0
          ? legs.map((item, index) => {
              const leg = asRecord(item) ?? {};
              return {
                sequence: asNumber(leg.sequence) ?? index,
                mode: asRouteMode(leg.mode),
                fromStopId: asString(leg.fromStopId) ?? '',
                toStopId: asString(leg.toStopId) ?? '',
                routeLabel: asString(leg.routeLabel) ?? '',
                distanceKm: asNumber(leg.distanceKm) ?? 0,
                durationMinutes: asNumber(leg.durationMinutes) ?? 0,
                fareProductCode: asString(leg.fareProductCode) ?? '',
                corridorTag: asString(leg.corridorTag) ?? '',
              };
            })
          : [createEmptyRouteLeg(0)],
      };
    }
    case 'route_update': {
      const route = asRecord(record.route) ?? {};
      const variant = asRecord(record.variant) ?? {};
      const legs = Array.isArray(record.legs) ? record.legs : [];

      return {
        route: {
          displayName: asString(route.displayName) ?? '',
          operatorName: asString(route.operatorName) ?? '',
          sourceName: asString(route.sourceName) ?? '',
          sourceUrl: asString(route.sourceUrl) ?? '',
        },
        variant: {
          code: asString(variant.code) ?? '',
          displayName: asString(variant.displayName) ?? '',
          directionLabel: asString(variant.directionLabel) ?? '',
          originPlaceId: asString(variant.originPlaceId) ?? '',
          destinationPlaceId: asString(variant.destinationPlaceId) ?? '',
        },
        legs: legs.length > 0
          ? legs.map((item, index) => {
              const leg = asRecord(item) ?? {};
              return {
                sequence: asNumber(leg.sequence) ?? index,
                mode: asRouteMode(leg.mode),
                fromStopId: asString(leg.fromStopId) ?? '',
                toStopId: asString(leg.toStopId) ?? '',
                routeLabel: asString(leg.routeLabel) ?? '',
                distanceKm: asNumber(leg.distanceKm) ?? 0,
                durationMinutes: asNumber(leg.durationMinutes) ?? 0,
                fareProductCode: asString(leg.fareProductCode) ?? '',
                corridorTag: asString(leg.corridorTag) ?? '',
              };
            })
          : [createEmptyRouteLeg(0)],
      };
    }
    case 'stop_correction':
      return {
        stopId: asString(record.stopId) ?? '',
        stopName: asString(record.stopName) ?? '',
        externalStopCode: asString(record.externalStopCode) ?? '',
        area: asString(record.area) ?? '',
        latitude: asNumber(record.latitude),
        longitude: asNumber(record.longitude),
        placeId: asString(record.placeId) ?? '',
        isActive: asBoolean(record.isActive),
      };
    case 'transfer_correction':
      return {
        transferPointId: asString(record.transferPointId) ?? '',
        fromStopId: asString(record.fromStopId) ?? '',
        toStopId: asString(record.toStopId) ?? '',
        walkingDistanceM: asNumber(record.walkingDistanceM),
        walkingDurationMinutes: asNumber(record.walkingDurationMinutes),
        isAccessible: asBoolean(record.isAccessible),
      };
    case 'fare_update': {
      const ruleVersion = asRecord(record.ruleVersion) ?? {};
      const fareProducts = Array.isArray(record.fareProducts) ? record.fareProducts : [];
      const trainStationFares = Array.isArray(record.trainStationFares) ? record.trainStationFares : [];

      return {
        ruleVersion: {
          mode: asFareMode(ruleVersion.mode),
          versionName: asString(ruleVersion.versionName) ?? '',
          sourceName: asString(ruleVersion.sourceName) ?? '',
          sourceUrl: asString(ruleVersion.sourceUrl) ?? '',
          effectivityDate: asString(ruleVersion.effectivityDate) ?? '',
          verifiedAt: asString(ruleVersion.verifiedAt) ?? '',
          trustLevel: asFareTrustLevel(ruleVersion.trustLevel),
        },
        activateVersion: asBoolean(record.activateVersion) ?? true,
        fareProducts: fareProducts.length > 0
          ? fareProducts.map((item) => {
              const product = asRecord(item) ?? {};
              return {
                productCode: asString(product.productCode) ?? '',
                mode: asFareMode(product.mode),
                pricingStrategy: asString(product.pricingStrategy) ?? 'minimum_plus_succeeding',
                vehicleClass: asString(product.vehicleClass) ?? 'standard',
                minimumDistanceKm: asNumber(product.minimumDistanceKm) ?? 0,
                minimumFareRegular: asNumber(product.minimumFareRegular) ?? 0,
                minimumFareDiscounted: asNumber(product.minimumFareDiscounted),
                succeedingDistanceKm: asNumber(product.succeedingDistanceKm) ?? 1,
                succeedingFareRegular: asNumber(product.succeedingFareRegular) ?? 0,
                succeedingFareDiscounted: asNumber(product.succeedingFareDiscounted),
                notes: asString(product.notes) ?? '',
              };
            })
          : [createEmptyFareProduct()],
        trainStationFares: trainStationFares.map((item) => {
          const fare = asRecord(item) ?? {};
          return {
            originStopId: asString(fare.originStopId) ?? '',
            destinationStopId: asString(fare.destinationStopId) ?? '',
            regularFare: asNumber(fare.regularFare) ?? 0,
            discountedFare: asNumber(fare.discountedFare) ?? 0,
          };
        }),
      };
    }
    default:
      return {};
  }
};
