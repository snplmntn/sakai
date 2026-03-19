function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderInline(value: string) {
  return escapeHtml(value)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

function renderListItem(item: string, stepImageSrc?: string) {
  const content = `<div class="guide-step-text">${renderInline(item)}</div>`;

  if (!stepImageSrc) {
    return `<li>${content}</li>`;
  }

  return [
    "<li>",
    content,
    `<img src="${escapeHtml(stepImageSrc)}" alt="" class="guide-step-image" loading="lazy" />`,
    "</li>",
  ].join("");
}

export function renderMarkdown(
  markdown: string,
  options?: { stepImages?: string[] },
) {
  const lines = markdown.split("\n");
  const html: string[] = [];
  let paragraph: string[] = [];
  let listItems: string[] = [];
  let listTag: "ol" | "ul" | null = null;
  let stepImageIndex = 0;

  const flushParagraph = () => {
    if (paragraph.length === 0) {
      return;
    }

    html.push(`<p>${renderInline(paragraph.join(" "))}</p>`);
    paragraph = [];
  };

  const flushList = () => {
    if (!listTag || listItems.length === 0) {
      listItems = [];
      listTag = null;
      return;
    }

    const items = listItems
      .map((item) => renderListItem(item, options?.stepImages?.[stepImageIndex++]))
      .join("");
    html.push(`<${listTag}>${items}</${listTag}>`);
    listItems = [];
    listTag = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    if (line.startsWith("### ")) {
      flushParagraph();
      flushList();
      html.push(`<h3>${renderInline(line.slice(4))}</h3>`);
      continue;
    }

    if (line.startsWith("## ")) {
      flushParagraph();
      flushList();
      html.push(`<h2>${renderInline(line.slice(3))}</h2>`);
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      flushParagraph();
      if (listTag && listTag !== "ol") {
        flushList();
      }
      listTag = "ol";
      listItems.push(line.replace(/^\d+\.\s+/, ""));
      continue;
    }

    if (line.startsWith("- ")) {
      flushParagraph();
      if (listTag && listTag !== "ul") {
        flushList();
      }
      listTag = "ul";
      listItems.push(line.slice(2));
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  flushParagraph();
  flushList();

  return html.join("");
}
