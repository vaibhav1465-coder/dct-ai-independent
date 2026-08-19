export function getArticleLabel(headline: string, article: string) {
  const trimmedHeadline = headline.trim();
  if (trimmedHeadline) return trimmedHeadline.slice(0, 120);
  const cleaned = article.replace(/\s+/g, " ").trim();
  if (!cleaned) return "Draft copy";
  const snippet = cleaned.slice(0, 72).trimEnd();
  return `${snippet}${cleaned.length > 72 ? "..." : ""}`.slice(0, 120);
}
