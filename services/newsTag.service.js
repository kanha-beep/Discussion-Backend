import axios from "axios";
import { XMLParser } from "fast-xml-parser";

const NEWS_FEED_URL = "https://feeds.feedburner.com/ndtvnews-top-stories";
const FALLBACK_NEWS_TAGS = ["headlines", "india", "world", "economy", "technology"];

let latestNewsItems = [];
let latestNewsTags = [...FALLBACK_NEWS_TAGS];
let lastNewsRefreshAt = 0;

const STOP_WORDS = new Set([
  "about", "after", "again", "also", "amid", "among", "and", "are", "because", "been",
  "before", "between", "both", "but", "from", "have", "into", "more", "news", "over",
  "said", "says", "than", "that", "their", "there", "these", "they", "this", "today",
  "under", "were", "what", "when", "where", "which", "while", "with", "would",
]);

const normalizeWord = (value = "") =>
  String(value)
    .toLowerCase()
    .replace(/&amp;/gi, "and")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const titleCase = (value = "") =>
  String(value)
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

export const extractRelevantNewsTags = (items = []) => {
  const counts = new Map();

  items.forEach((item) => {
    const category = Array.isArray(item?.category)
      ? item.category.join(" ")
      : item?.category || "";
    const sourceText = [item?.title, category, item?.description].filter(Boolean).join(" ");
    const normalized = normalizeWord(sourceText);

    normalized.split(" ").forEach((word) => {
      if (word.length < 4 || STOP_WORDS.has(word)) return;
      counts.set(word, (counts.get(word) || 0) + 1);
    });
  });

  const tags = [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 12)
    .map(([word]) => titleCase(word));

  return tags.length ? tags : [...FALLBACK_NEWS_TAGS];
};

export const refreshNewsTagPool = async ({ force = false } = {}) => {
  const now = Date.now();
  if (!force && latestNewsItems.length && now - lastNewsRefreshAt < 15 * 60 * 1000) {
    return { items: latestNewsItems, tags: latestNewsTags };
  }

  const response = await axios.get(NEWS_FEED_URL, {
    responseType: "text",
    headers: {
      "User-Agent": "Mozilla/5.0",
    },
  });

  const parser = new XMLParser();
  const jsonData = parser.parse(response.data);
  const items = jsonData?.rss?.channel?.item || [];
  const normalizedItems = Array.isArray(items) ? items : [items].filter(Boolean);

  latestNewsItems = normalizedItems;
  latestNewsTags = extractRelevantNewsTags(normalizedItems);
  lastNewsRefreshAt = now;

  return { items: latestNewsItems, tags: latestNewsTags };
};

export const getStoredNewsTags = () => [...latestNewsTags];

export const getDiscussionKeywordsFromNews = async (count = 4) => {
  try {
    const { tags } = await refreshNewsTagPool();
    return tags.slice(0, count);
  } catch (error) {
    console.log("error refreshing news tags:", error?.message);
    return latestNewsTags.slice(0, count);
  }
};
