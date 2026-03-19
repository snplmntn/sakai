import fs from "node:fs";
import path from "node:path";

const GUIDE_SOURCE_PATH = path.resolve(
  process.cwd(),
  "public",
  "commuting-guides.md",
);

const VEHICLE_CONFIG = [
  {
    label: "Walking",
    vehicleType: "walking",
    slug: "walking-guide",
    imageSrc: "/walking.jpg",
    stepImageDir: "/walking",
    tipImageFiles: ["1.jpg", "2.jpg", "3.jpg", "4.jpg", "5.jpg"],
    sectionHeading: "Walking",
  },
  {
    label: "Jeepney",
    vehicleType: "jeepney",
    slug: "jeepney-guide",
    imageSrc: "/jeepney.jpg",
    stepImageDir: "/jeep",
    stepImageFiles: ["1.jpg", "2.jpg", "3.jpg", "4.jpg", "5.jpg"],
    sectionHeading: "Jeepney",
  },
  {
    label: "MRT/LRT",
    vehicleType: "train",
    slug: "mrt-lrt-guide",
    imageSrc: "/mrt-lrt.jpg",
    stepImageDir: "/mrt-lrt",
    stepImageFiles: [
      "1.jpg",
      "2.jpg",
      "3.jpg",
      "4.jpg",
      "5.jpg",
      "6.jpg",
      "7.jpg",
      "8.jpg",
      "9.jpg",
      "10.jpg",
      "11.jpg",
    ],
    sectionHeading: "MRT/LRT",
  },
  {
    label: "Bus",
    vehicleType: "bus",
    slug: "bus-guide",
    imageSrc: "/bus.jpg",
    stepImageDir: "/bus",
    stepImageFiles: ["1.jpg", "2.jpg", "3.jpg", "4.jpg", "5.jpg"],
    sectionHeading: "Bus",
  },
  {
    label: "Tricycle",
    vehicleType: "tricycle",
    slug: "tricycle-guide",
    imageSrc: "/tricycle.jpg",
    stepImageDir: "/tricycle",
    stepImageFiles: ["1.jpg", "2.jpg", "3.jpg"],
    sectionHeading: "Tricycle",
  },
  {
    label: "FX",
    vehicleType: "fx",
    slug: "fx-guide",
    imageSrc: "/fx.jpg",
    stepImageDir: "/fx",
    stepImageFiles: ["1.jpg", "2.jpg", "3.jpg", "4.jpg", "5.jpg"],
    sectionHeading: "FX",
  },
  {
    label: "Taxi",
    vehicleType: "taxi",
    slug: "taxi-guide",
    imageSrc: "/taxi.jpg",
    stepImageDir: "/taxi",
    stepImageFiles: ["1.jpg", "2.jpg", "3.jpg"],
    tipImageFiles: ["4.jpg", "5.jpg"],
    sectionHeading: "Taxi",
  },
  {
    label: "Comet E-Jeep",
    vehicleType: "e-jeep",
    slug: "comet-e-jeep-guide",
    imageSrc: "/ejeep.jpg",
    stepImageDir: "/e-jeep",
    stepImageFiles: ["1.jpg", "2.jpg", "3.jpg", "4.jpg"],
    sectionHeading: "Comet E-Jeep",
  },
] as const;

type VehicleConfig = (typeof VEHICLE_CONFIG)[number];

export interface ParsedGuideSource {
  slug: string;
  title: string;
  label: string;
  vehicleType: string;
  imageSrc: string;
  stepImages: string[];
  tipImages: string[];
  summary: string;
  markdown: string;
  searchText: string;
}

let parsedGuideCache: ParsedGuideSource[] | null = null;

function normalizeText(value: string) {
  return value
    .replace(/\r/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/\uFFFD/g, "")
    .trimEnd();
}

function extractSectionContent(source: string, heading: string) {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `(?:^|\\n)#\\s+${escapedHeading}\\s*\\n([\\s\\S]*?)(?=\\n#\\s+|$)`,
  );
  const match = source.match(pattern);
  return match?.[1]?.trim() ?? "";
}

function splitSectionBlocks(section: string) {
  return normalizeText(section)
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
}

function normalizeBlock(block: string) {
  return block
    .replace(/[“”]/g, "")
    .replace(/[‘’]/g, "'")
    .replace(/\b(Bayad po|Para po|Thank you)\b/g, "**$1**")
    .replace(/\s+/g, " ")
    .trim();
}

function mergeIndentedContinuationLines(block: string) {
  const merged: string[] = [];

  for (const rawLine of block.split("\n")) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      continue;
    }

    const isContinuation = /^\s{2,}\S/.test(rawLine);
    if (isContinuation && merged.length > 0) {
      merged[merged.length - 1] = `${merged[merged.length - 1]} ${trimmed}`;
      continue;
    }

    merged.push(trimmed);
  }

  return merged;
}

function buildMarkdown(section: string) {
  const blocks = splitSectionBlocks(section);
  if (blocks.length === 0) {
    return { markdown: "", summary: "" };
  }

  const markdown: string[] = [];
  const summary = normalizeBlock(blocks[0]);

  markdown.push(summary, "");

  for (const block of blocks.slice(1)) {
    const lines = mergeIndentedContinuationLines(block);

    if (lines.length === 0) {
      continue;
    }

    if (lines[0].startsWith("### ")) {
      markdown.push(lines[0], "");

      for (const line of lines.slice(1)) {
        markdown.push(normalizeBlock(line));
      }

      markdown.push("");
      continue;
    }

    for (const line of lines) {
      markdown.push(normalizeBlock(line));
    }
    markdown.push("");
  }

  return {
    markdown: markdown.join("\n").trim(),
    summary,
  };
}

function getGuideTitle(config: VehicleConfig, markdown: string) {
  const headingMatch = markdown.match(/^##\s+(.+)$/m);
  if (headingMatch) {
    return headingMatch[1];
  }

  return config.label === "Walking" ? "Walking Guide" : `${config.label} Guide`;
}

function getStepImages(config: VehicleConfig) {
  if ("stepImageFiles" in config && config.stepImageFiles) {
    return config.stepImageFiles.map(
      (fileName) => `${config.stepImageDir}/${fileName}`,
    );
  }

  return [];
}

function getTipImages(config: VehicleConfig) {
  if ("tipImageFiles" in config && config.tipImageFiles) {
    return config.tipImageFiles.map(
      (fileName) => `${config.stepImageDir}/${fileName}`,
    );
  }

  return [];
}

export function getParsedGuideSource(): ParsedGuideSource[] {
  if (parsedGuideCache) {
    return parsedGuideCache;
  }

  const source = normalizeText(fs.readFileSync(GUIDE_SOURCE_PATH, "utf8"));

  parsedGuideCache = VEHICLE_CONFIG.flatMap((config) => {
    const section = extractSectionContent(source, config.sectionHeading);
    if (!section) {
      return [];
    }

    const { markdown, summary } = buildMarkdown(section);
    if (!markdown) {
      return [];
    }

    const title = getGuideTitle(config, markdown);
    const searchText = `${title} ${config.label} ${summary} ${markdown}`.toLowerCase();

    return [
      {
        slug: config.slug,
        title,
        label: config.label,
        vehicleType: config.vehicleType,
        imageSrc: config.imageSrc,
        stepImages: getStepImages(config),
        tipImages: getTipImages(config),
        summary,
        markdown,
        searchText,
      },
    ];
  });

  return parsedGuideCache;
}
