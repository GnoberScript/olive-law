import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourcePath = path.join(root, "constitution-source.html");
const outputPath = path.join(root, "src", "data", "constitution.json");

if (!fs.existsSync(sourcePath)) {
  throw new Error("constitution-source.html is missing. Download the Lawphil source first.");
}

const source = fs.readFileSync(sourcePath, "utf8");
const bodyStart = source.toLowerCase().indexOf("<blockquote>");
const bodyEnd = source.toLowerCase().lastIndexOf("</blockquote>");
if (bodyStart < 0 || bodyEnd <= bodyStart) throw new Error("Could not locate the constitutional text.");
const body = source.slice(bodyStart + "<blockquote>".length, bodyEnd);

const entities = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&quot;": '"',
  "&#39;": "'",
  "&lt;": "<",
  "&gt;": ">",
  "&ntilde;": "ñ",
  "&Ntilde;": "Ñ",
};

const decode = (value) =>
  value
    .replace(/&(?:nbsp|amp|quot|#39|lt|gt|ntilde|Ntilde);/g, (match) => entities[match] ?? match)
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));

const textOnly = (html) =>
  decode(
    html
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<\/(?:p|li)>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();

const cleanHtml = (html) =>
  decode(
    html
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<a\b[^>]*>/gi, "")
      .replace(/<\/a>/gi, "")
      .replace(/<\/?center\b[^>]*>/gi, "")
      .replace(/<p\b[^>]*>/gi, "<p>")
      .replace(/<ol\b[^>]*>/gi, "<ol>")
      .replace(/<li\b[^>]*>/gi, "<li>")
      .replace(/<br\s*\/?>/gi, "<br>")
      .replace(/<(?!\/?(?:p|ol|li|b|br)\b)[^>]+>/gi, ""),
  )
    .replace(/<p>\s*<\/p>/g, "")
    .trim();

const articlePattern =
  /<p\s+align=["']?center["']?\s*>\s*<b>\s*ARTICLE\s+([IVX]+)\s*<br\s*\/?>\s*([^<]*?)<\/b>/gi;
const matches = [...body.matchAll(articlePattern)];

const preambleStart = body.search(/<p\s+align=["']?center["']?\s*>\s*<b>\s*PREAMBLE\s*<\/b>/i);
const preambleBodyStart = body.indexOf("</p>", preambleStart) + 4;
const preambleHtml = cleanHtml(body.slice(preambleBodyStart, matches[0].index));

const articles = matches.map((match, index) => {
  const roman = match[1];
  const title = textOnly(match[2]);
  const start = match.index + match[0].length;
  const end = matches[index + 1]?.index ?? body.length;
  const articleHtml = body.slice(start, end);
  const sectionPattern = /<b>\s*Section\s+(\d+)\.\s*<\/b>/gi;
  const sectionMatches = [...articleHtml.matchAll(sectionPattern)];

  if (!sectionMatches.length) {
    const html = cleanHtml(articleHtml);
    return {
      roman,
      number: index + 1,
      title,
      sections: [{ number: null, ordinal: 1, html, text: textOnly(html) }],
    };
  }

  const sections = sectionMatches.map((sectionMatch, sectionIndex) => {
    const sectionStart = sectionMatch.index + sectionMatch[0].length;
    const sectionEnd = sectionMatches[sectionIndex + 1]?.index ?? articleHtml.length;
    const html = cleanHtml(articleHtml.slice(sectionStart, sectionEnd));
    return {
      number: Number(sectionMatch[1]),
      ordinal: sectionIndex + 1,
      html,
      text: textOnly(html),
    };
  });

  const prefatoryHtml = cleanHtml(articleHtml.slice(0, sectionMatches[0].index));
  if (textOnly(prefatoryHtml)) {
    sections.unshift({
      number: null,
      ordinal: 0,
      label: "Introductory text",
      html: prefatoryHtml,
      text: textOnly(prefatoryHtml),
    });
  }

  return { roman, number: index + 1, title, sections };
});

const corpus = {
  title: "1987 Constitution of the Republic of the Philippines",
  source: "The Lawphil Project, Arellano Law Foundation",
  sourceUrl: "https://lawphil.net/consti/cons1987.html",
  retrieved: new Date().toISOString().slice(0, 10),
  preamble: { html: preambleHtml, text: textOnly(preambleHtml) },
  articles,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(corpus, null, 2));
console.log(
  `Generated ${articles.length} articles and ${articles.reduce((sum, article) => sum + article.sections.length, 0)} provision blocks.`,
);
