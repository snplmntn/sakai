import type { RoutePreference } from "../models/user-preference.model.js";
import type { RouteModifier, RouteQueryOption } from "../types/route-query.js";

const getBalancedMetricScore = (value: number, minimum: number, maximum: number) => {
  if (maximum === minimum) {
    return 0;
  }

  return (value - minimum) / (maximum - minimum);
};

const sortRouteOptions = (options: RouteQueryOption[], compare: (left: RouteQueryOption, right: RouteQueryOption) => number) =>
  [...options].sort((left, right) => compare(left, right) || left.id.localeCompare(right.id));

const getRecommendationLabel = (_preference: RoutePreference) => "Best for your preference";

const getModifierSet = (modifiers: RouteModifier[]) => new Set(modifiers);

const getWalkingMetrics = (option: RouteQueryOption) =>
  option.legs.reduce(
    (metrics, leg) => {
      if (leg.type !== "walk") {
        return metrics;
      }

      return {
        distanceMeters: metrics.distanceMeters + leg.distanceMeters,
        durationMinutes: metrics.durationMinutes + leg.durationMinutes
      };
    },
    {
      distanceMeters: 0,
      durationMinutes: 0
    }
  );

const getJeepneyRideCount = (option: RouteQueryOption) =>
  option.legs.filter((leg) => leg.type === "ride" && leg.mode === "jeepney").length;

const getComparableFare = (option: RouteQueryOption) => option.totalFare ?? Number.MAX_SAFE_INTEGER;

const compareByModifiers = (
  left: RouteQueryOption,
  right: RouteQueryOption,
  modifiers: RouteModifier[]
) => {
  const modifierSet = getModifierSet(modifiers);

  if (modifierSet.has("jeep_if_possible")) {
    const leftJeepneyCount = getJeepneyRideCount(left);
    const rightJeepneyCount = getJeepneyRideCount(right);

    if ((leftJeepneyCount > 0 ? 1 : 0) !== (rightJeepneyCount > 0 ? 1 : 0)) {
      return (rightJeepneyCount > 0 ? 1 : 0) - (leftJeepneyCount > 0 ? 1 : 0);
    }

    if (leftJeepneyCount !== rightJeepneyCount) {
      return rightJeepneyCount - leftJeepneyCount;
    }
  }

  if (modifierSet.has("less_walking")) {
    const leftWalking = getWalkingMetrics(left);
    const rightWalking = getWalkingMetrics(right);

    if (leftWalking.distanceMeters !== rightWalking.distanceMeters) {
      return leftWalking.distanceMeters - rightWalking.distanceMeters;
    }

    if (leftWalking.durationMinutes !== rightWalking.durationMinutes) {
      return leftWalking.durationMinutes - rightWalking.durationMinutes;
    }
  }

  return 0;
};

export const rankRouteOptions = (
  options: RouteQueryOption[],
  preference: RoutePreference,
  modifiers: RouteModifier[] = []
): RouteQueryOption[] => {
  if (options.length === 0) {
    return [];
  }

  const compareWithModifiers = (
    left: RouteQueryOption,
    right: RouteQueryOption,
    fallbackCompare: (leftOption: RouteQueryOption, rightOption: RouteQueryOption) => number
  ) =>
    compareByModifiers(left, right, modifiers) ||
    fallbackCompare(left, right);

  const rankedOptions =
    preference === "fastest"
      ? sortRouteOptions(
          options,
          (left, right) =>
            compareWithModifiers(
              left,
              right,
              (leftOption, rightOption) =>
                leftOption.totalDurationMinutes - rightOption.totalDurationMinutes ||
                getComparableFare(leftOption) - getComparableFare(rightOption) ||
                leftOption.transferCount - rightOption.transferCount
            )
        )
      : preference === "cheapest"
        ? sortRouteOptions(
            options,
            (left, right) =>
              compareWithModifiers(
              left,
              right,
              (leftOption, rightOption) =>
                  getComparableFare(leftOption) - getComparableFare(rightOption) ||
                  leftOption.totalDurationMinutes - rightOption.totalDurationMinutes ||
                  leftOption.transferCount - rightOption.transferCount
              )
          )
        : (() => {
            const durations = options.map((option) => option.totalDurationMinutes);
            const fares = options.map((option) => getComparableFare(option));
            const transferCounts = options.map((option) => option.transferCount);
            const durationMinimum = Math.min(...durations);
            const durationMaximum = Math.max(...durations);
            const fareMinimum = Math.min(...fares);
            const fareMaximum = Math.max(...fares);
            const transferMinimum = Math.min(...transferCounts);
            const transferMaximum = Math.max(...transferCounts);

            return sortRouteOptions(options, (left, right) => {
              return compareWithModifiers(left, right, (leftOption, rightOption) => {
                const leftScore =
                  getBalancedMetricScore(
                    leftOption.totalDurationMinutes,
                    durationMinimum,
                    durationMaximum
                  ) *
                    0.45 +
                  getBalancedMetricScore(getComparableFare(leftOption), fareMinimum, fareMaximum) * 0.35 +
                  getBalancedMetricScore(
                    leftOption.transferCount,
                    transferMinimum,
                    transferMaximum
                  ) *
                    0.2;
                const rightScore =
                  getBalancedMetricScore(
                    rightOption.totalDurationMinutes,
                    durationMinimum,
                    durationMaximum
                  ) *
                    0.45 +
                  getBalancedMetricScore(getComparableFare(rightOption), fareMinimum, fareMaximum) * 0.35 +
                  getBalancedMetricScore(
                    rightOption.transferCount,
                    transferMinimum,
                    transferMaximum
                  ) *
                    0.2;

                return (
                  leftScore - rightScore ||
                  leftOption.totalDurationMinutes - rightOption.totalDurationMinutes ||
                  getComparableFare(leftOption) - getComparableFare(rightOption) ||
                  leftOption.transferCount - rightOption.transferCount
                );
              });
            });
          })();

  const minimumTransferCount = Math.min(...rankedOptions.map((option) => option.transferCount));
  const fewestTransferOptions = rankedOptions.filter(
    (option) => option.transferCount === minimumTransferCount
  );
  const minimumDuration = Math.min(...rankedOptions.map((option) => option.totalDurationMinutes));
  const fastestOptions = rankedOptions.filter(
    (option) => option.totalDurationMinutes === minimumDuration
  );
  const minimumFare = Math.min(...rankedOptions.map((option) => getComparableFare(option)));
  const cheapestOptions = rankedOptions.filter(
    (option) => getComparableFare(option) === minimumFare
  );
  const jeepneyLegCounts = rankedOptions.map((option) => ({
    id: option.id,
    count: option.legs.filter((leg) => leg.type === "ride" && leg.mode === "jeepney").length
  }));
  const maximumJeepneyLegCount = Math.max(...jeepneyLegCounts.map((entry) => entry.count));
  const mostJeepneyFriendlyOptions = jeepneyLegCounts.filter(
    (entry) => entry.count === maximumJeepneyLegCount
  );

  return rankedOptions.map((option, index) => {
    const highlights: string[] = [];
    const firstLeg = option.legs[0];
    const lastLeg = option.legs.at(-1);

    if (fastestOptions.length === 1 && option.totalDurationMinutes === minimumDuration) {
      highlights.push("Fastest option");
    }

    if (cheapestOptions.length === 1 && getComparableFare(option) === minimumFare) {
      highlights.push("Cheapest option");
    }

    if (fewestTransferOptions.length === 1 && option.transferCount === minimumTransferCount) {
      highlights.push("Fewest transfers");
    }

    if (
      maximumJeepneyLegCount > 0 &&
      mostJeepneyFriendlyOptions.length === 1 &&
      mostJeepneyFriendlyOptions[0]?.id === option.id
    ) {
      highlights.push("Most jeepney-friendly");
    }

    if (firstLeg?.type === "drive") {
      highlights.push("Car-first");
    }

    if (lastLeg?.type === "drive") {
      highlights.push("Car-last");
    }

    return {
      ...option,
      recommendationLabel: index === 0 ? getRecommendationLabel(preference) : option.recommendationLabel,
      highlights
    };
  });
};
