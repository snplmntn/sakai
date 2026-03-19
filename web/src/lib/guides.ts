import { getParsedGuideSource, type ParsedGuideSource } from "@/lib/guide-source";
import { renderMarkdown } from "@/lib/simple-markdown";

export interface GuideSummary {
  slug: string;
  title: string;
  label: string;
  vehicleType: string;
  imageSrc: string;
  summary: string;
  preview: string;
  readTimeLabel: string;
  searchText: string;
}

export interface GuideDetail extends GuideSummary {
  stepImages: string[];
  tipImages: string[];
  markdown: string;
  html: string;
}

export interface VehicleGroup {
  vehicleType: string;
  label: string;
  count: number;
}

function getReadTimeLabel(content: string) {
  const wordCount = content.split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(wordCount / 180));
  return `${minutes} min read`;
}

function buildGuideSummary(guide: ParsedGuideSource): GuideSummary {
  return {
    slug: guide.slug,
    title: guide.title,
    label: guide.label,
    vehicleType: guide.vehicleType,
    imageSrc: guide.imageSrc,
    summary: guide.summary,
    preview: guide.summary,
    readTimeLabel: getReadTimeLabel(guide.markdown),
    searchText: guide.searchText,
  };
}

export function getAllGuides() {
  return getParsedGuideSource().map(buildGuideSummary);
}

export function getGuideBySlug(slug: string): GuideDetail | undefined {
  const guide = getParsedGuideSource().find((item) => item.slug === slug);
  if (!guide) {
    return undefined;
  }

  const summary = buildGuideSummary(guide);
  return {
    ...summary,
    stepImages: guide.stepImages,
    tipImages: guide.tipImages,
    markdown: guide.markdown,
    html: renderMarkdown(guide.markdown, {
      stepImages: guide.stepImages,
      tipImages: guide.tipImages,
    }),
  };
}

export function getVehicleGroups(): VehicleGroup[] {
  const counts = new Map<string, VehicleGroup>();

  for (const guide of getAllGuides()) {
    const existing = counts.get(guide.vehicleType);
    if (existing) {
      existing.count += 1;
      continue;
    }

    counts.set(guide.vehicleType, {
      vehicleType: guide.vehicleType,
      label: guide.label,
      count: 1,
    });
  }

  return Array.from(counts.values());
}
