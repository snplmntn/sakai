import { chromium } from "playwright";

import { getEnv } from "../config/env.js";

export interface BrowserFetchedSource {
  content: string;
  finalUrl: string;
  extractedText?: string;
}

interface BrowserFetchOptions {
  extractDomText?: boolean;
}

export const fetchMmdaSourceWithBrowser = async (
  sourceUrl: string,
  options: BrowserFetchOptions = {}
): Promise<BrowserFetchedSource> => {
  const env = getEnv();
  const browser = await chromium.launch({
    headless: true,
    executablePath: env.MMDA_BROWSER_EXECUTABLE_PATH || undefined
  });

  try {
    const page = await browser.newPage({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    });

    await page.goto(sourceUrl, {
      waitUntil: "domcontentloaded",
      timeout: env.MMDA_BROWSER_TIMEOUT_MS
    });

    await page.waitForSelector("article", { timeout: 8000 }).catch(() => undefined);
    await page.waitForTimeout(2_000);
    await page.mouse.wheel(0, 1200);
    await page.waitForTimeout(1_000);

    const extractedText = options.extractDomText
      ? await (async () => {
          const selectorBuckets = [
            "article [data-testid='tweetText']",
            "article div[lang]",
            "article span[lang]",
            "[data-testid='cellInnerDiv'] [data-testid='tweetText']"
          ];

          const seen = new Set<string>();
          const lines: string[] = [];

          const addText = (raw: string | null) => {
            const text = raw?.replace(/\s+/g, " ").trim();
            if (!text) return;
            if (seen.has(text)) return;
            seen.add(text);
            lines.push(text);
          };

          for (const selector of selectorBuckets) {
            const texts = await page.locator(selector).allTextContents();
            for (const text of texts) {
              addText(text);
            }
          }

          if (lines.length === 0) {
            const articleTexts = await page.locator("article").allTextContents();
            for (const text of articleTexts) {
              addText(text);
            }
          }

          return lines.join(" ");
        })()
      : undefined;

    return {
      content: await page.content(),
      finalUrl: page.url(),
      extractedText
    };
  } finally {
    await browser.close();
  }
};
