import {
  getActiveFareRuleVersionsByModes,
  getFareProductsByVersionIdsAndCodes,
  getTrainStationFaresByVersionIdsAndPairs
} from "../models/fare.model.js";
import type {
  BasePricedFareSegment,
  FareConfidence,
  FareLookupKey,
  FareProduct,
  FareQuoteResult,
  FareResolutionReasonCode,
  FareRuleMode,
  FareRuleVersion,
  FareSegment,
  PassengerType,
  TrainStationFare
} from "../types/fare.js";

const FARE_STALENESS_THRESHOLD_DAYS = 180;
const TRAIN_MODES = new Set(["mrt3", "lrt1", "lrt2"]);
const PRODUCT_BACKED_MODES = new Set(["jeepney", "uv"]);

const getVersionKey = (mode: FareRuleMode) => mode;
const getProductKey = (fareRuleVersionId: string, productCode: string) =>
  `${fareRuleVersionId}:${productCode}`;
const getTrainFareKey = (
  fareRuleVersionId: string,
  originStopId: string,
  destinationStopId: string
) => `${fareRuleVersionId}:${originStopId}:${destinationStopId}`;

const roundCurrency = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const getDaysOld = (verifiedAt: string, now: Date) => {
  const verifiedAtTimestamp = Date.parse(verifiedAt);

  if (Number.isNaN(verifiedAtTimestamp)) {
    return 0;
  }

  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((now.getTime() - verifiedAtTimestamp) / millisecondsPerDay);
};

const appendUnique = (items: string[], value: string) => {
  if (!items.includes(value)) {
    items.push(value);
  }
};

const getVersionPricingType = (version: FareRuleVersion) =>
  version.trustLevel === "official" ? "official" : "estimated";

const isDiscountedPassenger = (passengerType: PassengerType) => passengerType !== "regular";

const getSegmentMode = (segment: FareSegment): FareRuleMode | null => {
  if (segment.kind === "transfer_walk") {
    return null;
  }

  if (segment.kind === "car_leg") {
    return "car";
  }

  return segment.mode;
};

const getProductMode = (segment: FareSegment) => {
  if (segment.kind === "car_leg") {
    return "car";
  }

  if (segment.kind === "ride_leg" && PRODUCT_BACKED_MODES.has(segment.mode)) {
    return segment.mode;
  }

  return null;
};

const createUnpriceableResult = (
  segments: BasePricedFareSegment[],
  fareAssumptions: string[],
  unresolvedSegmentId: string,
  reasonCode: FareResolutionReasonCode,
  message: string
): FareQuoteResult => {
  console.warn("Fare engine could not price segment", {
    unresolvedSegmentId,
    reasonCode,
    message
  });

  return {
    status: "unpriceable",
    segments,
    totalFare: null,
    fareConfidence: null,
    fareAssumptions,
    unresolvedSegmentId,
    reasonCode,
    message
  };
};

const buildSegmentAssumptions = (
  version: FareRuleVersion | null,
  extraAssumptions: string[],
  now: Date
) => {
  const assumptions = [...extraAssumptions];

  if (version) {
    const daysOld = getDaysOld(version.verifiedAt, now);

    if (daysOld > FARE_STALENESS_THRESHOLD_DAYS) {
      assumptions.unshift(
        `Fare table ${version.versionName} may be stale because it was last verified ${daysOld} days ago.`
      );
    }
  }

  return assumptions;
};

const resolveFareConfidence = (segments: BasePricedFareSegment[]): FareConfidence => {
  const paidSegments = segments.filter((segment) => segment.amount > 0);
  const hasOfficial = paidSegments.some((segment) => segment.pricingType === "official");
  const hasEstimated = paidSegments.some((segment) => segment.pricingType === "estimated");

  if (hasOfficial && hasEstimated) {
    return "partially_estimated";
  }

  if (hasEstimated) {
    return "estimated";
  }

  return "official";
};

const calculateProductFare = (
  product: FareProduct,
  passengerType: PassengerType,
  distanceKm: number
) => {
  const assumptions: string[] = [];
  const discountedPassenger = isDiscountedPassenger(passengerType);
  const regularMinimum = roundCurrency(product.minimumFareRegular);
  const discountedMinimum =
    product.minimumFareDiscounted === null
      ? null
      : roundCurrency(product.minimumFareDiscounted);
  const regularSucceeding = roundCurrency(product.succeedingFareRegular);
  const discountedSucceeding =
    product.succeedingFareDiscounted === null
      ? null
      : roundCurrency(product.succeedingFareDiscounted);

  const minimumFare =
    discountedPassenger && discountedMinimum !== null ? discountedMinimum : regularMinimum;
  const succeedingFare =
    discountedPassenger && discountedSucceeding !== null ? discountedSucceeding : regularSucceeding;

  if (
    discountedPassenger &&
    (discountedMinimum === null || discountedSucceeding === null)
  ) {
    assumptions.push(
      `Discounted pricing is unavailable for ${product.productCode}, so regular fare was used.`
    );
  }

  if (product.notes) {
    assumptions.push(product.notes);
  }

  if (product.pricingStrategy === "per_km") {
    return {
      amount: roundCurrency(distanceKm * succeedingFare),
      assumptions,
      isDiscountApplied:
        discountedPassenger && discountedMinimum !== null && discountedSucceeding !== null
    };
  }

  const remainingDistanceKm = Math.max(0, distanceKm - product.minimumDistanceKm);
  const additionalSteps =
    remainingDistanceKm <= 0
      ? 0
      : Math.ceil(remainingDistanceKm / product.succeedingDistanceKm);

  return {
    amount: roundCurrency(minimumFare + additionalSteps * succeedingFare),
    assumptions,
    isDiscountApplied:
      discountedPassenger && discountedMinimum !== null && discountedSucceeding !== null
  };
};

interface FareDataSource {
  getActiveFareRuleVersionsByModes: typeof getActiveFareRuleVersionsByModes;
  getFareProductsByVersionIdsAndCodes: typeof getFareProductsByVersionIdsAndCodes;
  getTrainStationFaresByVersionIdsAndPairs: typeof getTrainStationFaresByVersionIdsAndPairs;
}

export interface CalculateRouteFareOptions {
  segments: FareSegment[];
  passengerType: PassengerType;
  now?: Date;
  dataSource?: FareDataSource;
}

export const calculateRouteFare = async (
  options: CalculateRouteFareOptions
): Promise<FareQuoteResult> => {
  const now = options.now ?? new Date();
  const dataSource = options.dataSource ?? {
    getActiveFareRuleVersionsByModes,
    getFareProductsByVersionIdsAndCodes,
    getTrainStationFaresByVersionIdsAndPairs
  };
  const requiredModes = options.segments
    .map(getSegmentMode)
    .filter((mode): mode is FareRuleMode => mode !== null);
  const activeVersions = await dataSource.getActiveFareRuleVersionsByModes(requiredModes);
  const versionByMode = new Map(activeVersions.map((version) => [getVersionKey(version.mode), version]));
  const productVersionIds = activeVersions
    .filter((version) => PRODUCT_BACKED_MODES.has(version.mode) || version.mode === "car")
    .map((version) => version.id);
  const productCodes = options.segments
    .filter((segment): segment is Extract<FareSegment, { fareProductCode: string | null }> =>
      "fareProductCode" in segment
    )
    .map((segment) => segment.fareProductCode)
    .filter((productCode): productCode is string => productCode !== null);
  const fareProducts = await dataSource.getFareProductsByVersionIdsAndCodes({
    fareRuleVersionIds: productVersionIds,
    productCodes
  });
  const fareProductByKey = new Map(
    fareProducts.map((product) => [getProductKey(product.fareRuleVersionId, product.productCode), product])
  );
  const trainVersionIds = activeVersions
    .filter((version) => TRAIN_MODES.has(version.mode))
    .map((version) => version.id);
  const trainStopPairs = options.segments
    .filter(
      (segment): segment is Extract<FareSegment, { kind: "ride_leg" }> =>
        segment.kind === "ride_leg" && TRAIN_MODES.has(segment.mode)
    )
    .map<FareLookupKey>((segment) => ({
      originStopId: segment.fromStopId,
      destinationStopId: segment.toStopId
    }));
  const trainStationFares = await dataSource.getTrainStationFaresByVersionIdsAndPairs({
    fareRuleVersionIds: trainVersionIds,
    stopPairs: trainStopPairs
  });
  const trainFareByKey = new Map(
    trainStationFares.map((fare) => [
      getTrainFareKey(fare.fareRuleVersionId, fare.originStopId, fare.destinationStopId),
      fare
    ])
  );
  const pricedSegments: BasePricedFareSegment[] = [];
  const routeAssumptions: string[] = [];
  const loggedStaleVersionIds = new Set<string>();

  for (const segment of options.segments) {
    if (segment.kind === "transfer_walk") {
      pricedSegments.push({
        segmentId: segment.id,
        segmentKind: segment.kind,
        amount: 0,
        pricingType: "official",
        fareProductCode: null,
        ruleVersionName: null,
        effectivityDate: null,
        isDiscountApplied: false,
        assumptionText: null,
        reasonCode: null
      });
      continue;
    }

    const segmentMode = getSegmentMode(segment);

    if (!segmentMode) {
      continue;
    }

    const version = versionByMode.get(getVersionKey(segmentMode));

    if (!version) {
      return createUnpriceableResult(
        pricedSegments,
        routeAssumptions,
        segment.id,
        "missing_active_fare_rule_version",
        `No active fare rule version exists for mode ${segmentMode}.`
      );
    }

    const segmentAssumptions = [...buildSegmentAssumptions(version, [], now)];

    if (getDaysOld(version.verifiedAt, now) > FARE_STALENESS_THRESHOLD_DAYS) {
      appendUnique(
        routeAssumptions,
        `Fare table ${version.versionName} may be stale because it was last verified more than ${FARE_STALENESS_THRESHOLD_DAYS} days ago.`
      );
      if (!loggedStaleVersionIds.has(version.id)) {
        loggedStaleVersionIds.add(version.id);
        console.warn("Fare engine is using a stale fare version", {
          mode: version.mode,
          versionName: version.versionName,
          verifiedAt: version.verifiedAt
        });
      }
    }

    if (segment.kind === "ride_leg" && TRAIN_MODES.has(segment.mode)) {
      const trainFare = trainFareByKey.get(
        getTrainFareKey(version.id, segment.fromStopId, segment.toStopId)
      );

      if (!trainFare) {
        return createUnpriceableResult(
          pricedSegments,
          routeAssumptions,
          segment.id,
          "missing_train_station_fare",
          `No train station fare exists for ${segment.fromStopId} to ${segment.toStopId}.`
        );
      }

      const isDiscountApplied = isDiscountedPassenger(options.passengerType);
      const amount = roundCurrency(
        isDiscountApplied ? trainFare.discountedFare : trainFare.regularFare
      );
      const assumptionText = segmentAssumptions.length > 0 ? segmentAssumptions.join(" ") : null;

      if (assumptionText) {
        appendUnique(routeAssumptions, assumptionText);
      }

      pricedSegments.push({
        segmentId: segment.id,
        segmentKind: segment.kind,
        amount,
        pricingType: getVersionPricingType(version),
        fareProductCode: null,
        ruleVersionName: version.versionName,
        effectivityDate: version.effectivityDate,
        isDiscountApplied,
        assumptionText,
        reasonCode: null
      });
      continue;
    }

    const productMode = getProductMode(segment);

    if (!productMode) {
      return createUnpriceableResult(
        pricedSegments,
        routeAssumptions,
        segment.id,
        "missing_fare_product",
        `Unsupported fare segment kind ${segment.kind} for mode ${segmentMode}.`
      );
    }

    if (segment.fareProductCode === null) {
      return createUnpriceableResult(
        pricedSegments,
        routeAssumptions,
        segment.id,
        "missing_fare_product_code",
        `Segment ${segment.id} is missing a fare product code.`
      );
    }

    const product = fareProductByKey.get(getProductKey(version.id, segment.fareProductCode));

    if (!product || product.mode !== productMode) {
      return createUnpriceableResult(
        pricedSegments,
        routeAssumptions,
        segment.id,
        "missing_fare_product",
        `No fare product exists for code ${segment.fareProductCode} under version ${version.versionName}.`
      );
    }

    const calculatedFare = calculateProductFare(
      product,
      options.passengerType,
      segment.distanceKm
    );
    const extraAssumptions = [...segmentAssumptions, ...calculatedFare.assumptions];
    const assumptionText = extraAssumptions.length > 0 ? extraAssumptions.join(" ") : null;

    if (assumptionText) {
      appendUnique(routeAssumptions, assumptionText);
    }

    pricedSegments.push({
      segmentId: segment.id,
      segmentKind: segment.kind,
      amount: calculatedFare.amount,
      pricingType: segment.kind === "car_leg" ? "estimated" : getVersionPricingType(version),
      fareProductCode: segment.fareProductCode,
      ruleVersionName: version.versionName,
      effectivityDate: version.effectivityDate,
      isDiscountApplied: segment.kind === "car_leg" ? false : calculatedFare.isDiscountApplied,
      assumptionText,
      reasonCode: null
    });
  }

  return {
    status: "priced",
    segments: pricedSegments,
    totalFare: roundCurrency(
      pricedSegments.reduce((total, segment) => total + segment.amount, 0)
    ),
    fareConfidence: resolveFareConfidence(pricedSegments),
    fareAssumptions: routeAssumptions
  };
};
