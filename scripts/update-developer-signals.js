// This script finds the issues at https://github.com/web-platform-dx/developer-signals/issues/
// which are tagged with the "feature" label, maps them to feature IDs, gets the numer of
// reactions, and writes the data to a local file named developer-signals.json.

import path from "path";
import fs from "fs/promises";
import { features } from "web-features";
import { Octokit } from "octokit";

const octokitOptions = process?.env?.TOKEN
  // The token is provided via the TOKEN environment variable
  // that's usually set by the GitHub action.
  ? { auth: process.env.TOKEN }
  : {};

const octokit = new Octokit(octokitOptions);

const ORG = 'web-platform-dx';
const REPO = 'developer-signals';
const LABEL = 'feature';
const OUTPUT_FILE = path.join(import.meta.dirname, "../mappings/developer-signals.json");

async function getDeveloperSignalIssues() {
  const issues = [];
  let page = 1;

  while (true) {
    const response = await octokit.request("GET /repos/{owner}/{repo}/issues", {
      owner: ORG,
      repo: REPO,
      labels: LABEL,
      state: "all",
      per_page: 100,
      page,
    });

    if (response.data.length === 0) {
      break;
    }

    issues.push(...response.data);
    page++;
  }

  return issues;
}

function mapIssueToFeature(issue) {
  // Find https://web-platform-dx.github.io/web-features-explorer/features/<id> in the issue body.
  // <id> would be a web-features ID. Check if it's valid.
  const regex = /https:\/\/web-platform-dx\.github\.io\/web-features-explorer\/features\/([a-z0-9-]+)/g;
  const matches = [...issue.body.matchAll(regex)];
  const featureIds = matches.map(match => match[1]).filter(id => features[id]);

  if (featureIds.length === 0) {
    console.warn(`No valid feature ID found in issue #${issue.number}`);
    return null;
  }

  if (featureIds.length > 1) {
    console.warn(`Multiple feature IDs found in issue #${issue.number}: ${featureIds.join(", ")}`);
  }

  return featureIds[0];
}

function getIssueReactions(issue) {
  const reactions = issue.reactions;
  delete reactions.url;
  delete reactions.total_count;
  return reactions;
}

async function main() {
  const mapping = {};

  console.log("Getting developer signal issues...");
  const issues = await getDeveloperSignalIssues();
  console.log(`Found ${issues.length} issues with the "${LABEL}" label.`);

  for (const issue of issues) {
    const featureId = mapIssueToFeature(issue);
    if (!featureId) {
      console.log(`Ignoring issue #${issue.number} since no valid feature ID was found.`);
      continue;
    }

    console.log(`Issue #${issue.number} maps to feature ID: ${featureId}`);
    const reactions = getIssueReactions(issue);

    if (mapping[featureId]) {
      throw new Error(`Feature ID ${featureId} is already mapped to another issue. Please fix.`);
    }

    mapping[featureId] = {
      url: issue.html_url,
      reactions
    };
  }

  console.log(`Writing mapping to ${OUTPUT_FILE}...`);
  await fs.writeFile(OUTPUT_FILE, JSON.stringify(mapping, null, 2));
}

main();
