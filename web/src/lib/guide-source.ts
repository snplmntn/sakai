import fs from "node:fs";
import path from "node:path";

const GUIDE_SOURCE_PATH = path.resolve(
  process.cwd(),
  "..",
  "..",
  "commuting_guides",
  "guides.md",
);

const VEHICLE_CONFIG = [
  {
    label: "Walking",
    vehicleType: "walking",
    slug: "walking-guide",
    imageSrc: "/walking.jpg",
    stepImageDir: "/walking",
  },
  {
    label: "Jeepney",
    vehicleType: "jeepney",
    slug: "jeepney-guide",
    imageSrc: "/jeepney.jpg",
    stepImageDir: "/jeep",
  },
  {
    label: "MRT/LRT",
    vehicleType: "train",
    slug: "mrt-lrt-guide",
    imageSrc: "/mrt-lrt.jpg",
    stepImageDir: "/mrt-lrt",
  },
  {
    label: "Bus",
    vehicleType: "bus",
    slug: "bus-guide",
    imageSrc: "/bus.jpg",
    stepImageDir: "/bus",
  },
  {
    label: "Tricycle",
    vehicleType: "tricycle",
    slug: "tricycle-guide",
    imageSrc: "/tricycle.jpg",
    stepImageDir: "/tricycle",
  },
  {
    label: "FX",
    vehicleType: "fx",
    slug: "fx-guide",
    imageSrc: "/fx.jpg",
    stepImageDir: "/fx-",
  },
  {
    label: "Taxi",
    vehicleType: "taxi",
    slug: "taxi-guide",
    imageSrc: "/taxi.jpg",
    stepImageDir: "/taxi",
  },
  {
    label: "Comet E-Jeep",
    vehicleType: "e-jeep",
    slug: "comet-e-jeep-guide",
    imageSrc: "/ejeep.jpg",
    stepImageDir: "/e-jeep",
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
  summary: string;
  markdown: string;
  searchText: string;
}

let parsedGuideCache: ParsedGuideSource[] | null = null;

function decodeMojibake(value: string) {
  const decoded = Buffer.from(value, "latin1").toString("utf8");
  return decoded.includes("\uFFFD") ? value : decoded;
}

function normalizeText(value: string) {
  return decodeMojibake(value)
    .replace(/\r/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/\uFFFD/g, "'")
    .replace(/\u2019/g, "'")
    .replace(/\u2018/g, "'")
    .replace(/\u201c/g, '"')
    .replace(/\u201d/g, '"')
    .replace(/\u2013/g, "-")
    .replace(/\u2014/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/â€™/g, "'")
    .replace(/â€˜/g, "'")
    .replace(/â€œ/g, '"')
    .replace(/â€/g, '"')
    .replace(/â€“/g, "-")
    .replace(/â€”/g, "-")
    .replace(/â€¦/g, "...")
    .replace(/singlejourney/g, "single-journey")
    .replace(/shortdistance/g, "short-distance")
    .replace(/\s+/g, " ")
    .trim();
}

function splitIntoSections(source: string) {
  const lines = source.split("\n").map((line) => line.trimEnd());
  const sections = new Map<string, string[]>();
  let current: string | null = null;

  for (const rawLine of lines) {
    const line = normalizeText(rawLine);

    if (!line) {
      if (current) {
        sections.get(current)?.push("");
      }
      continue;
    }

    const heading = VEHICLE_CONFIG.find((item) => item.label === line);
    if (heading) {
      current = heading.label;
      sections.set(current, []);
      continue;
    }

    if (current) {
      sections.get(current)?.push(line);
    }
  }

  return sections;
}

function isSubheading(line: string) {
  return (
    line.startsWith("How to Ride the ") ||
    line.startsWith("Tips for ") ||
    line === "Tips:"
  );
}

function buildMarkdown(title: string, lines: string[]) {
  const markdown: string[] = [];
  const introParagraphs: string[] = [];
  let paragraph: string[] = [];
  let listItems: string[] = [];
  let listType: "ol" | "ul" | null = null;

  const flushParagraph = () => {
    if (paragraph.length === 0) {
      return;
    }

    const text = paragraph.join(" ").replace(/\s+/g, " ").trim();
    if (text) {
      markdown.push(text, "");
      if (introParagraphs.length === 0) {
        introParagraphs.push(text);
      }
    }
    paragraph = [];
  };

  const flushList = () => {
    if (listItems.length === 0 || !listType) {
      listItems = [];
      listType = null;
      return;
    }

    listItems.forEach((item, index) => {
      const normalized = item.replace(/\s+/g, " ").trim();
      markdown.push(
        listType === "ol" ? `${index + 1}. ${normalized}` : `- ${normalized}`,
      );
    });
    markdown.push("");
    listItems = [];
    listType = null;
  };

  const appendToActiveBlock = (value: string) => {
    if (listItems.length > 0) {
      const lastIndex = listItems.length - 1;
      listItems[lastIndex] = `${listItems[lastIndex]} ${value}`.trim();
      return true;
    }

    if (paragraph.length > 0) {
      paragraph.push(value);
      return true;
    }

    return false;
  };

  for (const line of lines) {
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    if (isSubheading(line)) {
      flushParagraph();
      flushList();
      markdown.push(`## ${line === "Tips:" ? `${title} Tips` : line}`, "");
      continue;
    }

    const orderedMatch = line.match(/^(\d+)\.\s+(.*)$/);
    if (orderedMatch) {
      flushParagraph();
      if (listType && listType !== "ol") {
        flushList();
      }
      listType = "ol";
      listItems.push(orderedMatch[2]);
      continue;
    }

    const bulletMatch = line.match(/^-\s+(.*)$/);
    if (bulletMatch) {
      flushParagraph();
      if (listType && listType !== "ul") {
        flushList();
      }
      listType = "ul";
      listItems.push(bulletMatch[1]);
      continue;
    }

    if (!appendToActiveBlock(line)) {
      paragraph.push(line);
    }
  }

  flushParagraph();
  flushList();

  const summary = introParagraphs[0] ?? `${title} commuter guide`;
  return {
    markdown: markdown.join("\n").trim(),
    summary,
  };
}

function getGuideTitle(config: VehicleConfig, markdown: string) {
  const headingMatch = markdown.match(/^##\s+(.+)$/m);
  if (headingMatch && headingMatch[1].startsWith("How to Ride")) {
    return headingMatch[1];
  }

  return config.label === "Walking" ? "Walking Guide" : `${config.label} Guide`;
}

function getStepImages(config: VehicleConfig) {
  const stepImages: string[] = [];
  const publicDir = path.resolve(process.cwd(), "public");
  const stepImageDir = config.stepImageDir.replace(/^\//, "");

  for (let index = 1; ; index += 1) {
    const relativePath = path.join(stepImageDir, `${index}.jpg`);
    const relativeSrc = `/${relativePath.replace(/\\/g, "/")}`;
    const imagePath = path.join(publicDir, relativePath);

    if (!fs.existsSync(imagePath)) {
      break;
    }

    stepImages.push(relativeSrc);
  }

  return stepImages;
}

export function getParsedGuideSource(): ParsedGuideSource[] {
  if (parsedGuideCache) {
    return parsedGuideCache;
  }

  const source = fs.readFileSync(GUIDE_SOURCE_PATH, "utf8");
  const sections = splitIntoSections(source);

  parsedGuideCache = VEHICLE_CONFIG.flatMap((config) => {
    const lines = sections.get(config.label);
    if (!lines || lines.length === 0) {
      return [];
    }

    const { markdown, summary } = buildMarkdown(config.label, lines);
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
        summary,
        markdown,
        searchText,
      },
    ];
  });

  return parsedGuideCache;
}
