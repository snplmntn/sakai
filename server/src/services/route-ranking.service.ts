import type { RoutePreference } from "../models/user-preference.model.js";
import type { RouteQueryOption } from "../types/route-query.js";

const getBalancedMetricScore = (value: number, minimum: number, maximum: number) => {
  if (maximum === minimum) {
    return 0;
  }

  return (value - minimum) / (maximum - minimum);
};

const sortRouteOptions = (options: RouteQueryOption[], compare: (left: RouteQueryOption, right: RouteQueryOption) => number) =>
  [...options].sort((left, right) => compare(left, right) || left.id.localeCompare(right.id));

const getRecommendationLabel = (preference: RoutePreference) => {
  if (preference === "fastest") {
    return "Fastest option";
  }

  if (preference === "cheapest") {
    return "Cheapest option";
  }

  return "Balanced option";
};

export const rankRouteOptions = (
  options: RouteQueryOption[],
  preference: RoutePreference
): RouteQueryOption[] => {
  if (options.length === 0) {
    return [];
  }

  const rankedOptions =
    preference === "fastest"
      ? sortRouteOptions(
          options,
          (left, right) =>
            left.totalDurationMinutes - right.totalDurationMinutes ||
            left.totalFare - right.totalFare ||
            left.transferCount - right.transferCount
        )
      : preference === "cheapest"
        ? sortRouteOptions(
            options,
            (left, right) =>
              left.totalFare - right.totalFare ||
              left.totalDurationMinutes - right.totalDurationMinutes ||
              left.transferCount - right.transferCount
          )
        : (() => {
            const durations = options.map((option) => option.totalDurationMinutes);
            const fares = options.map((option) => option.totalFare);
            const transferCounts = options.map((option) => option.transferCount);
            const durationMinimum = Math.min(...durations);
            const durationMaximum = Math.max(...durations);
            const fareMinimum = Math.min(...fares);
            const fareMaximum = Math.max(...fares);
            const transferMinimum = Math.min(...transferCounts);
            const transferMaximum = Math.max(...transferCounts);

            return sortRouteOptions(options, (left, right) => {
              const leftScore =
                getBalancedMetricScore(
                  left.totalDurationMinutes,
                  durationMinimum,
                  durationMaximum
                ) *
                  0.45 +
                getBalancedMetricScore(left.totalFare, fareMinimum, fareMaximum) * 0.35 +
                getBalancedMetricScore(
                  left.transferCount,
                  transferMinimum,
                  transferMaximum
                ) *
                  0.2;
              const rightScore =
                getBalancedMetricScore(
                  right.totalDurationMinutes,
                  durationMinimum,
                  durationMaximum
                ) *
                  0.45 +
                getBalancedMetricScore(right.totalFare, fareMinimum, fareMaximum) * 0.35 +
                getBalancedMetricScore(
                  right.transferCount,
                  transferMinimum,
                  transferMaximum
                ) *
                  0.2;

              return (
                leftScore - rightScore ||
                left.totalDurationMinutes - right.totalDurationMinutes ||
                left.totalFare - right.totalFare ||
                left.transferCount - right.transferCount
              );
            });
          })();

  const minimumTransferCount = Math.min(...rankedOptions.map((option) => option.transferCount));
  const fewestTransferOptions = rankedOptions.filter(
    (option) => option.transferCount === minimumTransferCount
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

    return {
      ...option,
      recommendationLabel: index === 0 ? getRecommendationLabel(preference) : option.recommendationLabel,
      highlights
    };
  });
};
