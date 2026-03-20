import * as areaUpdateModel from "../models/area-update.model.js";
import * as placeModel from "../models/place.model.js";
import type {
  RouteQueryIncident,
  RouteQueryNormalizedInput,
  RouteQueryOption
} from "../types/route-query.js";

const DEFAULT_INCIDENT_LIMIT = 3;

const getIncidentSeverityWeight = (severity: "low" | "medium" | "high") =>
  severity === "high" ? 3 : severity === "medium" ? 2 : 1;

const sortRelevantIncidents = (
  incidents: areaUpdateModel.AreaUpdate[]
) =>
  [...incidents].sort(
    (left, right) =>
      getIncidentSeverityWeight(right.severity) - getIncidentSeverityWeight(left.severity) ||
      right.scrapedAt.localeCompare(left.scrapedAt) ||
      left.id.localeCompare(right.id)
  );

const toRouteIncident = (incident: areaUpdateModel.AreaUpdate): RouteQueryIncident => ({
  id: incident.id,
  alertType: incident.alertType,
  location: incident.location,
  direction: incident.direction,
  severity: incident.severity,
  summary: incident.summary,
  displayUntil: incident.displayUntil,
  scrapedAt: incident.scrapedAt,
  sourceUrl: incident.sourceUrl
});

export const filterRelevantIncidents = (input: {
  incidents: areaUpdateModel.AreaUpdate[];
  corridorTags: string[];
  originLabel: string;
  destinationLabel: string;
  limit?: number;
}): RouteQueryIncident[] => {
  const corridorTags = new Set(input.corridorTags.map((tag) => tag.toLowerCase()));
  const originLabel = placeModel.normalizePlaceSearchText(input.originLabel);
  const destinationLabel = placeModel.normalizePlaceSearchText(input.destinationLabel);

  return sortRelevantIncidents(
    input.incidents.filter((incident) => {
      const incidentLocation = placeModel.normalizePlaceSearchText(incident.normalizedLocation);

      return (
        incident.corridorTags.some((tag) => corridorTags.has(tag.toLowerCase())) ||
        incidentLocation.includes(originLabel) ||
        incidentLocation.includes(destinationLabel)
      );
    })
  )
    .slice(0, input.limit ?? DEFAULT_INCIDENT_LIMIT)
    .map(toRouteIncident);
};

export const attachRelevantIncidentsToOptions = async (input: {
  options: RouteQueryOption[];
  normalizedQuery: RouteQueryNormalizedInput;
  limit?: number;
}): Promise<RouteQueryOption[]> => {
  if (input.options.length === 0) {
    return input.options;
  }

  let activeIncidents: areaUpdateModel.AreaUpdate[];

  try {
    activeIncidents = await areaUpdateModel.listActiveAreaUpdates(100);
  } catch (error) {
    console.warn("Unable to load active area updates for route query", {
      operation: "route_query_incidents",
      reason: error instanceof Error ? error.message : "unknown error"
    });
    return input.options;
  }

  if (activeIncidents.length === 0) {
    return input.options;
  }

  return input.options.map((option) => ({
    ...option,
    relevantIncidents: filterRelevantIncidents({
      incidents: activeIncidents,
      corridorTags: option.corridorTags,
      originLabel: input.normalizedQuery.origin.label,
      destinationLabel: input.normalizedQuery.destination.label,
      limit: input.limit
    })
  }));
};

export const listRelevantAreaUpdates = async (input: {
  corridorTags: string[];
  originLabel: string;
  destinationLabel: string;
  limit?: number;
}): Promise<RouteQueryIncident[]> => {
  const activeIncidents = await areaUpdateModel.listActiveAreaUpdates(100);

  if (activeIncidents.length === 0) {
    return [];
  }

  return filterRelevantIncidents({
    incidents: activeIncidents,
    corridorTags: input.corridorTags,
    originLabel: input.originLabel,
    destinationLabel: input.destinationLabel,
    limit: input.limit
  });
};
