import * as fareModel from "../models/fare.model.js";
import { HttpError } from "../types/http-error.js";
import type { RideMode } from "../types/route-network.js";
import type {
  FareBreakdown,
  FareConfidence,
  FareProduct,
  FareRuleMode,
  FareRuleVersion,
  PassengerType,
  PricingType,
  TrainStationFare
} from "../types/fare.js";

export interface FareRideLegInput {
  id: string;
  mode: RideMode;
  distanceKm: number;
  fareProductCode: string | null;
  fromStopId: string;
  toStopId: string;
}

export interface PricedRideLeg {
  id: string;
  fare: FareBreakdown;
}

export interface FarePricingResult {
  rideLegs: PricedRideLeg[];
  totalFare: number;
  fareConfidence: FareConfidence;
  fareAssumptions: string[];
}

const STALE_FARE_THRESHOLD_DAYS = 365;

const roundUpFareAmount = (value: number) => Math.ceil(Math.max(0, value));
const calculateDiscountedTrainFare = (regularFare: number) => roundUpFareAmount(regularFare * 0.5);

const getPricingType = (ruleVersion: FareRuleVersion): PricingType => {
  if (ruleVersion.trustLevel === "official") {
    return "official";
  }

  if (ruleVersion.trustLevel === "estimated") {
    return "estimated";
  }

  return "community_estimated";
};

const buildStaleFareAssumption = (ruleVersion: FareRuleVersion) =>
  `Fare ruleset ${ruleVersion.versionName} may be stale`;

const isRuleVersionStale = (ruleVersion: FareRuleVersion) => {
  const verifiedAt = Date.parse(ruleVersion.verifiedAt);

  if (Number.isNaN(verifiedAt)) {
    return false;
  }

  return Date.now() - verifiedAt > STALE_FARE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;
};

const getFareAmountForPassengerType = (
  passengerType: PassengerType,
  regularAmount: number,
  discountedAmount: number | null
) => {
  if (passengerType === "regular") {
    return {
      amount: regularAmount,
      isDiscountApplied: false,
      assumptionText: null as string | null
    };
  }

  if (discountedAmount === null) {
    return {
      amount: regularAmount,
      isDiscountApplied: false,
      assumptionText: `Discounted fare unavailable for ${passengerType}; used regular fare`
    };
  }

  return {
    amount: discountedAmount,
    isDiscountApplied: true,
    assumptionText: null as string | null
  };
};

const calculateMinimumPlusSucceedingFare = (
  fareProduct: FareProduct,
  passengerType: PassengerType,
  distanceKm: number
) => {
  const minimumFare = getFareAmountForPassengerType(
    passengerType,
    fareProduct.minimumFareRegular,
    fareProduct.minimumFareDiscounted
  );

  if (distanceKm <= fareProduct.minimumDistanceKm) {
    return minimumFare;
  }

  const succeedingFare = getFareAmountForPassengerType(
    passengerType,
    fareProduct.succeedingFareRegular,
    fareProduct.succeedingFareDiscounted
  );
  const additionalDistanceKm = distanceKm - fareProduct.minimumDistanceKm;
  const additionalUnits = Math.ceil(additionalDistanceKm / fareProduct.succeedingDistanceKm);
  const amount = roundUpFareAmount(minimumFare.amount + additionalUnits * succeedingFare.amount);

  return {
    amount,
    isDiscountApplied: minimumFare.isDiscountApplied || succeedingFare.isDiscountApplied,
    assumptionText: minimumFare.assumptionText ?? succeedingFare.assumptionText
  };
};

const calculatePerKmFare = (
  fareProduct: FareProduct,
  passengerType: PassengerType,
  distanceKm: number
) => {
  const baseFare = getFareAmountForPassengerType(
    passengerType,
    fareProduct.minimumFareRegular,
    fareProduct.minimumFareDiscounted
  );
  const perKmFare = getFareAmountForPassengerType(
    passengerType,
    fareProduct.succeedingFareRegular,
    fareProduct.succeedingFareDiscounted
  );
  const billableDistanceKm = Math.max(0, distanceKm - fareProduct.minimumDistanceKm);
  const amount = roundUpFareAmount(baseFare.amount + billableDistanceKm * perKmFare.amount);

  return {
    amount,
    isDiscountApplied: baseFare.isDiscountApplied || perKmFare.isDiscountApplied,
    assumptionText: baseFare.assumptionText ?? perKmFare.assumptionText
  };
};

const buildFareBreakdown = (input: {
  amount: number;
  ruleVersion: FareRuleVersion;
  fareProductCode: string | null;
  isDiscountApplied: boolean;
  assumptionText: string | null;
}): FareBreakdown => {
  const assumptions = [
    input.assumptionText,
    isRuleVersionStale(input.ruleVersion) ? buildStaleFareAssumption(input.ruleVersion) : null
  ].filter((value): value is string => Boolean(value));

  return {
    amount: roundUpFareAmount(input.amount),
    pricingType: getPricingType(input.ruleVersion),
    fareProductCode: input.fareProductCode,
    ruleVersionName: input.ruleVersion.versionName,
    effectivityDate: input.ruleVersion.effectivityDate,
    isDiscountApplied: input.isDiscountApplied,
    assumptionText: assumptions.length > 0 ? assumptions.join("; ") : null
  };
};

const priceFareProductRideLeg = (
  input: FareRideLegInput,
  passengerType: PassengerType,
  fareProduct: FareProduct,
  ruleVersion: FareRuleVersion
): FareBreakdown => {
  const calculation =
    fareProduct.pricingStrategy === "minimum_plus_succeeding"
      ? calculateMinimumPlusSucceedingFare(fareProduct, passengerType, input.distanceKm)
      : calculatePerKmFare(fareProduct, passengerType, input.distanceKm);

  return buildFareBreakdown({
    amount: calculation.amount,
    ruleVersion,
    fareProductCode: fareProduct.productCode,
    isDiscountApplied: calculation.isDiscountApplied,
    assumptionText: calculation.assumptionText
  });
};

const priceTrainRideLeg = (
  input: FareRideLegInput,
  passengerType: PassengerType,
  trainStationFares: TrainStationFare[],
  ruleVersion: FareRuleVersion
): FareBreakdown => {
  const trainFare =
    trainStationFares.find(
      (fare) => fare.originStopId === input.fromStopId && fare.destinationStopId === input.toStopId
    ) ??
    trainStationFares.find(
      (fare) => fare.originStopId === input.toStopId && fare.destinationStopId === input.fromStopId
    );

  if (!trainFare) {
    throw new HttpError(
      500,
      `Missing train fare for ${input.mode} segment ${input.fromStopId} -> ${input.toStopId}`
    );
  }

  const amount =
    passengerType === "regular"
      ? roundUpFareAmount(trainFare.regularFare)
      : calculateDiscountedTrainFare(trainFare.regularFare);

  return buildFareBreakdown({
    amount,
    ruleVersion,
    fareProductCode: null,
    isDiscountApplied: passengerType !== "regular",
    assumptionText: null
  });
};

export const priceRideLegsWithCatalog = (
  fareCatalog: fareModel.ActiveFareCatalog,
  rideLegs: FareRideLegInput[],
  passengerType: PassengerType
): FarePricingResult => {
  if (rideLegs.length === 0) {
    return {
      rideLegs: [],
      totalFare: 0,
      fareConfidence: "official",
      fareAssumptions: []
    };
  }

  const ruleVersionByMode = new Map(
    fareCatalog.ruleVersions.map((ruleVersion) => [ruleVersion.mode, ruleVersion])
  );
  const fareProductByCode = new Map(
    fareCatalog.fareProducts.map((fareProduct) => [fareProduct.productCode, fareProduct])
  );
  const trainFaresByRuleVersionId = new Map<string, TrainStationFare[]>();

  for (const trainFare of fareCatalog.trainStationFares) {
    const existingTrainFares =
      trainFaresByRuleVersionId.get(trainFare.fareRuleVersionId) ?? [];

    existingTrainFares.push(trainFare);
    trainFaresByRuleVersionId.set(trainFare.fareRuleVersionId, existingTrainFares);
  }

  const pricedRideLegs = rideLegs.map((rideLeg) => {
    const ruleVersion = ruleVersionByMode.get(rideLeg.mode as FareRuleMode);

    if (!ruleVersion) {
      throw new HttpError(500, `Missing active fare rules for mode ${rideLeg.mode}`);
    }

    if (rideLeg.mode === "mrt3" || rideLeg.mode === "lrt1" || rideLeg.mode === "lrt2") {
      return {
        id: rideLeg.id,
        fare: priceTrainRideLeg(
          rideLeg,
          passengerType,
          trainFaresByRuleVersionId.get(ruleVersion.id) ?? [],
          ruleVersion
        )
      };
    }

    if (!rideLeg.fareProductCode) {
      throw new HttpError(500, `Ride leg ${rideLeg.id} is missing fare product code`);
    }

    const fareProduct = fareProductByCode.get(rideLeg.fareProductCode);

    if (!fareProduct) {
      throw new HttpError(500, `Missing fare product ${rideLeg.fareProductCode}`);
    }

    return {
      id: rideLeg.id,
      fare: priceFareProductRideLeg(rideLeg, passengerType, fareProduct, ruleVersion)
    };
  });

  const fareAssumptions = [
    ...new Set(
      pricedRideLegs
        .map((pricedRideLeg) => pricedRideLeg.fare.assumptionText)
        .filter((value): value is string => Boolean(value))
    )
  ];
  const fareConfidence = pricedRideLegs.some((pricedRideLeg) => pricedRideLeg.fare.pricingType !== "official")
    ? pricedRideLegs.every((pricedRideLeg) => pricedRideLeg.fare.pricingType !== "official")
      ? "estimated"
      : "partially_estimated"
    : "official";

  return {
    rideLegs: pricedRideLegs,
    totalFare: roundUpFareAmount(
      pricedRideLegs.reduce((total, pricedRideLeg) => total + pricedRideLeg.fare.amount, 0)
    ),
    fareConfidence,
    fareAssumptions
  };
};

export const priceRideLegs = async (
  rideLegs: FareRideLegInput[],
  passengerType: PassengerType
): Promise<FarePricingResult> => {
  if (rideLegs.length === 0) {
    return {
      rideLegs: [],
      totalFare: 0,
      fareConfidence: "official",
      fareAssumptions: []
    };
  }

  const modes = [...new Set(rideLegs.map((leg) => leg.mode as FareRuleMode))];
  const fareCatalog = await fareModel.getActiveFareCatalog(modes);
  return priceRideLegsWithCatalog(fareCatalog, rideLegs, passengerType);
};
