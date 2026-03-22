import type { RoutePreference } from "../models/user-preference.model.js";
import type { TransitStop, TransitStopEdge } from "../models/transit-graph.model.js";
import type { Stop, TransferPoint } from "../types/route-network.js";
import type { CommuteMode, RouteModifier } from "../types/route-query.js";

const normalizePlannerText = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ");

interface ManualInterchangeSpec {
  sourceNames: string[];
  targetNames: string[];
  distanceMeters: number;
  durationMinutes: number;
}

const MANUAL_INTERCHANGE_SPECS: ManualInterchangeSpec[] = [
  {
    sourceNames: ["Doroteo Jose LRT"],
    targetNames: ["Recto LRT"],
    distanceMeters: 240,
    durationMinutes: 3.5
  },
  {
    sourceNames: ["EDSA LRT"],
    targetNames: ["Taft Ave MRT"],
    distanceMeters: 60,
    durationMinutes: 1
  },
  {
    sourceNames: ["Cubao LRT", "Araneta Center Cubao LRT"],
    targetNames: ["Cubao MRT"],
    distanceMeters: 180,
    durationMinutes: 3
  }
];

const JEEP_MODES = new Set(["jeep", "jeepney"]);
const TRICYCLE_MODES = new Set(["tricycle"]);
const UV_MODES = new Set(["uv"]);
const LRT_MODES = new Set(["lrt", "lrt1", "lrt2"]);
const MRT_MODES = new Set(["mrt", "mrt3"]);
export const DEFAULT_COMMUTE_MODES: CommuteMode[] = ["jeepney", "train", "uv", "bus", "tricycle"];

const normalizeMode = (mode: string) => mode.trim().toLowerCase();

const isJeepMode = (mode: string) => JEEP_MODES.has(normalizeMode(mode));
const isTricycleMode = (mode: string) => TRICYCLE_MODES.has(normalizeMode(mode));
const isUvMode = (mode: string) => UV_MODES.has(normalizeMode(mode));
const isLrtMode = (mode: string) => LRT_MODES.has(normalizeMode(mode));
const isMrtMode = (mode: string) => MRT_MODES.has(normalizeMode(mode));

const isRailMode = (mode: string, routeName?: string | null) => {
  const normalizedRouteName = normalizePlannerText(routeName ?? "");

  return (
    isLrtMode(mode) ||
    isMrtMode(mode) ||
    normalizedRouteName.includes("lrt") ||
    normalizedRouteName.includes("mrt")
  );
};

export const normalizeCommuteModes = (commuteModes: CommuteMode[]) => {
  const uniqueModes = [...new Set(commuteModes)];

  return uniqueModes.filter(
    (commuteMode): commuteMode is CommuteMode =>
      commuteMode === "jeepney" ||
      commuteMode === "train" ||
      commuteMode === "uv" ||
      commuteMode === "bus" ||
      commuteMode === "tricycle"
  );
};

export const usesAllCommuteModes = (commuteModes: CommuteMode[]) =>
  normalizeCommuteModes(commuteModes).length >= DEFAULT_COMMUTE_MODES.length;

export const hasTrainCommutePreference = (commuteModes: CommuteMode[]) =>
  normalizeCommuteModes(commuteModes).includes("train") && !usesAllCommuteModes(commuteModes);

export const mapRideModeToCommuteMode = (
  mode: string,
  routeName?: string | null
): CommuteMode | null => {
  const normalizedMode = normalizeMode(mode);

  if (isJeepMode(normalizedMode)) {
    return "jeepney";
  }

  if (isTricycleMode(normalizedMode)) {
    return "tricycle";
  }

  if (isUvMode(normalizedMode)) {
    return "uv";
  }

  if (normalizedMode === "bus") {
    return "bus";
  }

  if (isRailMode(normalizedMode, routeName)) {
    return "train";
  }

  return null;
};

const getStationFamily = (mode: string, routeNames: string[] = []) => {
  const normalizedMode = normalizeMode(mode);
  const routeBlob = normalizePlannerText(routeNames.join(" "));

  if (isLrtMode(normalizedMode) || routeBlob.includes("lrt")) {
    return "lrt" as const;
  }

  if (isMrtMode(normalizedMode) || routeBlob.includes("mrt")) {
    return "mrt" as const;
  }

  if (isJeepMode(normalizedMode)) {
    return "jeep" as const;
  }

  if (isUvMode(normalizedMode)) {
    return "uv" as const;
  }

  if (normalizedMode === "walk_anchor" || normalizedMode === "walk" || normalizedMode === "transfer") {
    return "walk" as const;
  }

  return "other" as const;
};

const getKnownInterchangeLabel = (leftLabel: string, rightLabel: string) => {
  const pair = new Set([
    normalizePlannerText(leftLabel),
    normalizePlannerText(rightLabel)
  ]);

  for (const spec of MANUAL_INTERCHANGE_SPECS) {
    for (const sourceName of spec.sourceNames) {
      for (const targetName of spec.targetNames) {
        const specPair = new Set([
          normalizePlannerText(sourceName),
          normalizePlannerText(targetName)
        ]);

        if (pair.size === specPair.size && [...pair].every((value) => specPair.has(value))) {
          return `${sourceName} to ${targetName}`;
        }
      }
    }
  }

  return null;
};

const buildTransferId = (fromStopId: string, toStopId: string) => `manual:${fromStopId}:${toStopId}`;

const buildManualTransferPoint = (
  fromStopId: string,
  toStopId: string,
  spec: ManualInterchangeSpec
): TransferPoint => ({
  id: buildTransferId(fromStopId, toStopId),
  fromStopId,
  toStopId,
  walkingDistanceM: spec.distanceMeters,
  walkingDurationMinutes: spec.durationMinutes,
  isAccessible: true,
  createdAt: new Date(0).toISOString()
});

export const buildRuntimeManualTransferPoints = (stops: Stop[]): TransferPoint[] => {
  const stopIdsByName = new Map<string, string[]>();
  const seenTransfers = new Set<string>();
  const transfers: TransferPoint[] = [];

  for (const stop of stops) {
    const normalizedName = normalizePlannerText(stop.stopName);
    const existing = stopIdsByName.get(normalizedName) ?? [];
    existing.push(stop.id);
    stopIdsByName.set(normalizedName, existing);
  }

  for (const spec of MANUAL_INTERCHANGE_SPECS) {
    const sourceIds = spec.sourceNames.flatMap((name) => stopIdsByName.get(normalizePlannerText(name)) ?? []);
    const targetIds = spec.targetNames.flatMap((name) => stopIdsByName.get(normalizePlannerText(name)) ?? []);

    for (const sourceId of sourceIds) {
      for (const targetId of targetIds) {
        if (sourceId === targetId) {
          continue;
        }

        for (const [leftId, rightId] of [
          [sourceId, targetId],
          [targetId, sourceId]
        ]) {
          const dedupeKey = `${leftId}:${rightId}`;

          if (seenTransfers.has(dedupeKey)) {
            continue;
          }

          seenTransfers.add(dedupeKey);
          transfers.push(buildManualTransferPoint(leftId, rightId, spec));
        }
      }
    }
  }

  return transfers;
};

export const listRuntimeManualInterchangeCounterpartQueries = (stopName: string) => {
  const normalizedStopName = normalizePlannerText(stopName);
  const counterpartQueries = new Set<string>();

  for (const spec of MANUAL_INTERCHANGE_SPECS) {
    const sourceMatches = spec.sourceNames.some((name) => normalizePlannerText(name) === normalizedStopName);
    const targetMatches = spec.targetNames.some((name) => normalizePlannerText(name) === normalizedStopName);

    if (!sourceMatches && !targetMatches) {
      continue;
    }

    for (const counterpartName of sourceMatches ? spec.targetNames : spec.sourceNames) {
      counterpartQueries.add(counterpartName);
    }
  }

  return [...counterpartQueries];
};

export const listAllManualInterchangeStopNames = (): string[] => {
  const names = new Set<string>();

  for (const spec of MANUAL_INTERCHANGE_SPECS) {
    for (const name of spec.sourceNames) {
      names.add(name);
    }

    for (const name of spec.targetNames) {
      names.add(name);
    }
  }

  return [...names];
};

const buildManualInterchangeEdge = (
  fromStop: TransitStop,
  toStop: TransitStop,
  spec: ManualInterchangeSpec
): TransitStopEdge => ({
  sourceStopId: fromStop.stopId,
  targetStopId: toStop.stopId,
  weight: spec.durationMinutes,
  mode: "transfer",
  line: "manual_interchange",
  routeShortName: "transfer",
  routeLongName: "manual interchange",
  transfer: true,
  distanceMeters: spec.distanceMeters,
  estimatedTimeMinutes: spec.durationMinutes,
  dataSource: "manual_interchange",
  createdAt: new Date(0).toISOString()
});

export const buildRuntimeManualInterchangeEdges = (
  currentStopId: string,
  stopMap: Map<string, TransitStop>
): TransitStopEdge[] => {
  const currentStop = stopMap.get(currentStopId);

  if (!currentStop) {
    return [];
  }

  const currentName = normalizePlannerText(currentStop.stopName);
  const edges: TransitStopEdge[] = [];
  const seenTargets = new Set<string>();

  for (const spec of MANUAL_INTERCHANGE_SPECS) {
    const sourceMatches = spec.sourceNames.some((name) => normalizePlannerText(name) === currentName);
    const targetMatches = spec.targetNames.some((name) => normalizePlannerText(name) === currentName);

    if (!sourceMatches && !targetMatches) {
      continue;
    }

    const counterpartNames = sourceMatches ? spec.targetNames : spec.sourceNames;

    for (const stop of stopMap.values()) {
      if (
        stop.stopId !== currentStop.stopId &&
        counterpartNames.some((name) => normalizePlannerText(name) === normalizePlannerText(stop.stopName)) &&
        !seenTargets.has(stop.stopId)
      ) {
        seenTargets.add(stop.stopId);
        edges.push(buildManualInterchangeEdge(currentStop, stop, spec));
      }
    }
  }

  return edges;
};

const getBalancedModeMultiplier = (input: {
  edgeMode: string;
  routeName: string;
  originFamily: string;
  destinationFamily: string;
  isTransfer: boolean;
}) => {
  const isJeep = isJeepMode(input.edgeMode);
  const isLrt = isLrtMode(input.edgeMode) || normalizePlannerText(input.routeName).includes("lrt");
  const isMrt = isMrtMode(input.edgeMode) || normalizePlannerText(input.routeName).includes("mrt");
  const isRail = isLrt || isMrt;
  const railEndpoints =
    (input.originFamily === "lrt" || input.originFamily === "mrt") &&
    (input.destinationFamily === "lrt" || input.destinationFamily === "mrt");

  if (railEndpoints) {
    if (isJeep) {
      return 0.88;
    }

    if (isRail) {
      return 1.08;
    }

    if (input.isTransfer) {
      return 1;
    }
  }

  if (input.originFamily === "lrt" && input.destinationFamily === "lrt") {
    if (isJeep) {
      return 0.9;
    }

    if (isLrt) {
      return 1.08;
    }
  }

  if (input.originFamily === "mrt" && input.destinationFamily === "mrt") {
    if (isJeep) {
      return 0.9;
    }

    if (isMrt) {
      return 1.08;
    }
  }

  if (isJeep) {
    return 0.9;
  }

  if (isRail) {
    return 1.04;
  }

  return 1;
};

const getMixPreferenceModeMultiplier = (edgeMode: string, routeName: string) => {
  if (isJeepMode(edgeMode)) {
    return 0.72;
  }

  if (isRailMode(edgeMode, routeName)) {
    return 1.22;
  }

  return 1;
};

export const getJeepneyPriorityAdjustment = (input: {
  preference: RoutePreference;
  jeepLegCount: number;
  railLegCount: number;
}) => {
  if (input.preference !== "balanced") {
    return 0;
  }

  let adjustment = 0;

  if (input.jeepLegCount === 0) {
    adjustment += 24;
  } else if (input.jeepLegCount >= 1 && input.jeepLegCount <= 5) {
    adjustment -= 7.5;
  } else {
    adjustment += (input.jeepLegCount - 5) * 1.8;
  }

  return adjustment;
};

export const getTransferMultiplier = (input: {
  isTransfer: boolean;
  distanceMeters: number;
  fromLabel: string;
  toLabel: string;
}) => {
  if (!input.isTransfer) {
    return 1;
  }

  if (getKnownInterchangeLabel(input.fromLabel, input.toLabel)) {
    return 0.65;
  }

  if (input.distanceMeters <= 35) {
    return 0.7;
  }

  if (input.distanceMeters <= 100) {
    return 0.85;
  }

  return 1;
};

export const getTransitEdgeTraversalWeight = (input: {
  edge: TransitStopEdge;
  sourceStop?: TransitStop;
  targetStop?: TransitStop;
  preference: RoutePreference;
  modifiers: RouteModifier[];
  commuteModes: CommuteMode[];
  originFamily: string;
  destinationFamily: string;
}) => {
  const baseCost = input.edge.estimatedTimeMinutes || input.edge.weight;
  const routeName = `${input.edge.routeShortName ?? ""} ${input.edge.routeLongName ?? ""} ${input.edge.line}`.trim();
  const transferPenalty = input.edge.transfer ? 6 : 0;
  const hopPenalty = input.edge.transfer ? 0 : 0.35;
  let segmentCost = baseCost + transferPenalty + hopPenalty;

  if (input.edge.transfer) {
    segmentCost *= getTransferMultiplier({
      isTransfer: true,
      distanceMeters: input.edge.distanceMeters,
      fromLabel: input.sourceStop?.stopName ?? input.edge.sourceStopId,
      toLabel: input.targetStop?.stopName ?? input.edge.targetStopId
    });
  }

  if (input.preference === "balanced") {
    const mixMultiplier = getMixPreferenceModeMultiplier(input.edge.mode, routeName);
    segmentCost *= mixMultiplier;
    segmentCost *= getBalancedModeMultiplier({
      edgeMode: input.edge.mode,
      routeName,
      originFamily: input.originFamily,
      destinationFamily: input.destinationFamily,
      isTransfer: input.edge.transfer
    });
  } else if (input.preference === "cheapest") {
    if (isJeepMode(input.edge.mode)) {
      segmentCost *= 0.86;
    } else if (isRailMode(input.edge.mode, routeName)) {
      segmentCost *= 1.35;
    }
  }

  if (input.modifiers.includes("jeep_if_possible")) {
    if (isJeepMode(input.edge.mode)) {
      segmentCost *= 0.82;
    } else if (isRailMode(input.edge.mode, routeName)) {
      segmentCost *= 1.18;
    }
  }

  if (input.modifiers.includes("less_walking") && input.edge.transfer) {
    segmentCost *= 1.45;
  }

  if (!input.edge.transfer) {
    const commuteMode = mapRideModeToCommuteMode(input.edge.mode, routeName);
    const preferredCommuteModes = new Set(normalizeCommuteModes(input.commuteModes));
    const trainPreferred = hasTrainCommutePreference(input.commuteModes);

    if (
      commuteMode &&
      preferredCommuteModes.size > 0 &&
      !usesAllCommuteModes(input.commuteModes)
    ) {
      if (trainPreferred && commuteMode === "train") {
        segmentCost *= preferredCommuteModes.size === 1 ? 0.64 : 0.72;
      } else if (trainPreferred && commuteMode !== "train") {
        segmentCost *= preferredCommuteModes.has(commuteMode) ? 0.94 : 1.42;
      } else {
        segmentCost *= preferredCommuteModes.has(commuteMode) ? 0.82 : 1.2;
      }
    }
  }

  return segmentCost;
};

export interface PlannerRideSegmentMetrics {
  mode: string;
  durationMinutes: number;
  distanceMeters: number;
  transferBefore: boolean;
  transferAfter: boolean;
}

export interface PlannerCandidateMetrics {
  score: number;
  commuterEfficiencyScore: number;
  transferCount: number;
  rideHopCount: number;
  totalDurationMinutes: number;
  routeRankScore: number;
}

export const awkwardMicroRidePenalty = (rideSegments: PlannerRideSegmentMetrics[]) => {
  let penalty = 0;

  for (const ride of rideSegments) {
    if (!isJeepMode(ride.mode) && !isUvMode(ride.mode)) {
      continue;
    }

    const shortRide = ride.durationMinutes <= 4 || ride.distanceMeters <= 900;

    if (!shortRide) {
      continue;
    }

    if (ride.transferBefore && ride.transferAfter) {
      penalty += 2.5;
    } else if (ride.transferBefore || ride.transferAfter) {
      penalty += 1.2;
    } else {
      penalty += 0.6;
    }
  }

  return penalty;
};

export const buildPlannerCandidateMetrics = (input: {
  preference: RoutePreference;
  modifiers: RouteModifier[];
  commuteModes: CommuteMode[];
  totalDurationMinutes: number;
  rideSegments: PlannerRideSegmentMetrics[];
  transferDurationsMinutes: number[];
}) => {
  const transferCount = input.transferDurationsMinutes.length;
  const rideHopCount = input.rideSegments.length;
  const microRidePenalty = awkwardMicroRidePenalty(input.rideSegments);
  const transferWalkMinutes = input.transferDurationsMinutes.reduce((total, value) => total + value, 0);
  const jeepRideCount = input.rideSegments.filter((segment) => isJeepMode(segment.mode)).length;
  const railRideCount = input.rideSegments.filter((segment) => isRailMode(segment.mode)).length;
  const tricycleRideCount = input.rideSegments.filter((segment) => isTricycleMode(segment.mode)).length;
  const preferredCommuteModes = new Set(normalizeCommuteModes(input.commuteModes));
  const applyCommuteModePreference =
    preferredCommuteModes.size > 0 && !usesAllCommuteModes(input.commuteModes);
  const trainPreferred = hasTrainCommutePreference(input.commuteModes);
  const preferredRideSegmentCount = applyCommuteModePreference
    ? input.rideSegments.filter((segment) => {
        const commuteMode = mapRideModeToCommuteMode(segment.mode);

        return commuteMode !== null && preferredCommuteModes.has(commuteMode);
      }).length
    : 0;
  const unpreferredRideSegmentCount = applyCommuteModePreference
    ? input.rideSegments.filter((segment) => {
        const commuteMode = mapRideModeToCommuteMode(segment.mode);

        return commuteMode !== null && !preferredCommuteModes.has(commuteMode);
      }).length
    : 0;

  const commuterEfficiencyScore =
    input.totalDurationMinutes + transferCount * 12 + rideHopCount * 4 + microRidePenalty +
    getJeepneyPriorityAdjustment({
      preference: input.preference,
      jeepLegCount: input.rideSegments.filter((segment) => isJeepMode(segment.mode)).length,
      railLegCount: input.rideSegments.filter((segment) => isRailMode(segment.mode)).length
    });
  let score =
    input.preference === "fastest"
      ? input.totalDurationMinutes + transferCount * 5 + rideHopCount * 1.5 + microRidePenalty
      : input.preference === "cheapest"
        ? input.totalDurationMinutes + transferCount * 7 + rideHopCount * 2 + microRidePenalty
        : commuterEfficiencyScore;

  if (input.preference === "cheapest") {
    score += railRideCount * 4;
    score -= jeepRideCount * 1.5;
  }

  if (input.modifiers.includes("jeep_if_possible")) {
    score -= jeepRideCount * 3;
    score += railRideCount * 2;
  }

  if (input.modifiers.includes("less_walking")) {
    score += transferWalkMinutes * 1.5;
  }

  if (applyCommuteModePreference) {
    score -= preferredRideSegmentCount * 2.5;
    score += unpreferredRideSegmentCount * 4;
  }

  if (trainPreferred) {
    const nonTrainRideCount = rideHopCount - railRideCount;

    score -= railRideCount * 5.5;
    score += nonTrainRideCount * 6.5;

    if (railRideCount === 0) {
      score += 14;
    }
  }

  if (preferredCommuteModes.has("tricycle")) {
    score -= tricycleRideCount * 1.5;
  }

  return {
    score,
    commuterEfficiencyScore,
    transferCount,
    rideHopCount,
    totalDurationMinutes: input.totalDurationMinutes,
    routeRankScore: input.totalDurationMinutes + microRidePenalty
  } satisfies PlannerCandidateMetrics;
};

export const dominatesPlannerCandidate = (
  left: PlannerCandidateMetrics,
  right: PlannerCandidateMetrics
) =>
  left.commuterEfficiencyScore <= right.commuterEfficiencyScore &&
  left.transferCount <= right.transferCount &&
  left.rideHopCount <= right.rideHopCount &&
  left.totalDurationMinutes <= right.totalDurationMinutes &&
  left.routeRankScore <= right.routeRankScore &&
  (
    left.commuterEfficiencyScore < right.commuterEfficiencyScore ||
    left.transferCount < right.transferCount ||
    left.rideHopCount < right.rideHopCount ||
    left.totalDurationMinutes < right.totalDurationMinutes ||
    left.routeRankScore < right.routeRankScore
  );

export const getStopFamily = (stop: Pick<Stop, "mode"> | Pick<TransitStop, "mode" | "allLines">) =>
  getStationFamily(stop.mode, "allLines" in stop ? stop.allLines : []);
