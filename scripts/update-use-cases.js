// This script updates use-cases.json from web-platform-dx/developer-signals issues.
// It extracts use-cases from template-compliant issue comments and stores them
// by web-features ID. Existing records are preserved and only new comment URLs
// are appended.

import { features } from "web-features";
import path from "path";
import fs from "fs/promises";

const OUTPUT_FILE = path.join(import.meta.dirname, "../mappings/use-cases.json");
const SIGNALS_FILE = path.join(import.meta.dirname, "../mappings/developer-signals.json");

const GITHUB_API_BASE = "https://api.github.com/repos/web-platform-dx/developer-signals";
const ISSUE_NUMBER_RE = /\/issues\/(\d+)(?:$|[#/?])/;
const COMMENT_ID_RE = /#issuecomment-(\d+)$/;
const CODE_FENCE_RE = /^\s*(```|~~~)/;
const HEADING_RE = /^\s{0,3}(#{2,6})\s+(.+?)\s*#*\s*$/;
const COMMENTS_PER_PAGE = 100;

function getGitHubHeaders() {
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "web-features-mappings-use-cases-updater",
  };

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  return headers;
}

async function fetchGitHubJson(url) {
  const response = await fetch(url, { headers: getGitHubHeaders() });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

function extractIssueNumberFromUrl(url) {
  const match = url.match(ISSUE_NUMBER_RE);
  if (!match) {
    return null;
  }
  return Number.parseInt(match[1], 10);
}

function normalizeHeadingText(text) {
  return text
    .toLowerCase()
    .replace(/\[[^\]]+\]\([^\)]+\)/g, " ")
    .replace(/[`*_~]/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchesWhatIWantHeading(normalized) {
  return (
    /what i want .*do with this feature/.test(normalized) ||
    /what i want .*be able to do/.test(normalized)
  );
}

function matchesMeantimeHeading(normalized) {
  return (
    /what i.?m having to do in the meantime/.test(normalized) ||
    /what i have to do at the moment/.test(normalized)
  );
}

function getMarkdownHeadings(markdown) {
  const lines = markdown.split(/\r?\n/);
  const headings = [];

  let inCodeFence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (CODE_FENCE_RE.test(line)) {
      inCodeFence = !inCodeFence;
      continue;
    }

    if (inCodeFence) {
      continue;
    }

    const match = line.match(HEADING_RE);
    if (!match) {
      continue;
    }

    headings.push({
      lineIndex: i,
      level: match[1].length,
      normalizedText: normalizeHeadingText(match[2]),
    });
  }

  return { lines, headings };
}

function extractUseCaseSection(markdown) {
  const { lines, headings } = getMarkdownHeadings(markdown);

  const targetHeading = headings.find((heading) => matchesWhatIWantHeading(heading.normalizedText));
  const meantimeHeading = headings.find((heading) => matchesMeantimeHeading(heading.normalizedText));

  // Keep only comments following the template shape.
  if (!targetHeading || !meantimeHeading) {
    return null;
  }

  let endLine = lines.length;
  for (const heading of headings) {
    if (heading.lineIndex <= targetHeading.lineIndex) {
      continue;
    }
    if (heading.level <= targetHeading.level) {
      endLine = heading.lineIndex;
      break;
    }
  }

  const sectionText = lines.slice(targetHeading.lineIndex + 1, endLine).join("\n").trim();
  if (!sectionText) {
    return null;
  }

  const nonCommentText = sectionText.replace(/<!--[\s\S]*?-->/g, "").trim();
  if (!nonCommentText) {
    return null;
  }

  return sectionText;
}

function extractKnownCommentIds(existingRecords) {
  const ids = new Set();

  for (const record of existingRecords) {
    if (!record || typeof record.url !== "string") {
      continue;
    }
    const match = record.url.match(COMMENT_ID_RE);
    if (match) {
      ids.add(match[1]);
    }
  }

  return ids;
}

async function getIssue(issueNumber) {
  return fetchGitHubJson(`${GITHUB_API_BASE}/issues/${issueNumber}`);
}

async function getIssueComments(issueNumber, knownCommentIds = new Set()) {
  const comments = [];

  for (let page = 1; ; page++) {
    const url = `${GITHUB_API_BASE}/issues/${issueNumber}/comments?per_page=${COMMENTS_PER_PAGE}&page=${page}`;
    const pageComments = await fetchGitHubJson(url);

    if (pageComments.length === 0) {
      break;
    }

    for (const comment of pageComments) {
      const id = String(comment.id);
      if (!knownCommentIds.has(id)) {
        comments.push(comment);
      }
    }

    if (pageComments.length < COMMENTS_PER_PAGE) {
      break;
    }
  }

  return comments;
}

async function readJsonFile(filePath, fallbackValue) {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content);
  } catch {
    return fallbackValue;
  }
}

async function writeMapping(mapping) {
  const sorted = {};
  for (const key of Object.keys(mapping).sort()) {
    sorted[key] = mapping[key];
  }
  await fs.writeFile(OUTPUT_FILE, JSON.stringify(sorted, null, 2));
}

async function main() {
  const signals = await readJsonFile(SIGNALS_FILE, {});
  const mapping = await readJsonFile(OUTPUT_FILE, {});

  let processed = 0;
  let discovered = 0;

  for (const [featureId, signal] of Object.entries(signals)) {
    if (!features[featureId]) {
      console.warn(`Skipping unknown feature ID in developer-signals: ${featureId}`);
      continue;
    }

    if (typeof signal?.url !== "string") {
      continue;
    }

    const issueNumber = extractIssueNumberFromUrl(signal.url);
    if (!issueNumber) {
      console.warn(`Skipping invalid issue URL for ${featureId}: ${signal.url}`);
      continue;
    }

    processed += 1;

    try {
      const existingRecords = Array.isArray(mapping[featureId]) ? mapping[featureId] : [];
      const existingUrls = new Set(
        existingRecords
          .filter((record) => record && typeof record.url === "string")
          .map((record) => record.url)
      );

      const knownCommentIds = extractKnownCommentIds(existingRecords);

      // When we already have records for this feature, fetch the issue metadata
      // first to check whether the comment count has grown. This avoids fetching
      // all comments again when nothing has changed.
      if (knownCommentIds.size > 0) {
        const issue = await getIssue(issueNumber);
        if (typeof issue.comments === "number" && knownCommentIds.size >= issue.comments) {
          continue;
        }
      }

      const comments = await getIssueComments(issueNumber, knownCommentIds);
      const newRecords = [];

      for (const comment of comments) {
        if (typeof comment?.html_url !== "string" || typeof comment?.body !== "string") {
          continue;
        }
        if (existingUrls.has(comment.html_url)) {
          continue;
        }

        const description = extractUseCaseSection(comment.body);
        if (!description) {
          continue;
        }

        newRecords.push({
          description,
          url: comment.html_url,
        });
        existingUrls.add(comment.html_url);
      }

      if (newRecords.length === 0) {
        continue;
      }

      mapping[featureId] = [...existingRecords, ...newRecords];
      discovered += newRecords.length;

      // Write incrementally to avoid losing progress in long CI runs.
      await writeMapping(mapping);

      console.log(`${featureId}: added ${newRecords.length} use case(s).`);
    } catch (error) {
      console.error(`Failed to process ${featureId} (issue #${issueNumber}):`, error.message);
    }
  }

  await writeMapping(mapping);
  console.log(`Processed ${processed} issue(s), discovered ${discovered} new use case(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
