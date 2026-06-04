// This script updates the chrome-status.json mapping file.
// It iterates over all web-features and queries the Chrome Status API
// to find matching features by their web_feature_id.

import { features } from "web-features";
import path from "path";
import fs from "fs/promises";

const OUTPUT_FILE = path.join(import.meta.dirname, "../mappings/chrome-status.json");

async function getChromeStatusFeatures(id) {
  const url = `https://chromestatus.com/api/v0/features?q=web_feature_id=${id}`;

  console.log(`Fetching Chrome Status data for feature ID: ${id}...`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch from Chrome Status API: ${response.status} ${response.statusText}`);
  }

  // The Chrome Status API prepends a security prefix to the JSON response.
  let text = await response.text();
  text = text.substring(4);
  const data = JSON.parse(text);

  return (data.features || []).map(feature => ({
    id: feature.id,
    name: feature.name,
    summary: feature.summary,
    motivation: feature.motivation,
    url: `https://chromestatus.com/feature/${feature.id}`,
    "bug-url": feature.bug_url || null,
    "spec-link": feature.spec_link || null,
    "explainer-links": feature.explainer_links || [],
    updated: feature.updated || null,
  }));
}

function maybeGetOriginalIdForMovedFeature(newId) {
  for (const id in features) {
    if (features[id].kind === "moved" && features[id].redirect_target === newId) {
      return id;
    }
  }
  return null;
}

async function main() {
  // Read existing mapping to preserve previously fetched data.
  let mapping = {};
  try {
    const existing = await fs.readFile(OUTPUT_FILE, "utf-8");
    mapping = JSON.parse(existing);
  } catch {
    // No existing file, start fresh.
  }

  for (const id in features) {
    // Only consider real features.
    if (features[id].kind !== "feature") {
      continue;
    }

    // Get the chrome status entries for this feature ID.
    const chromeStatusFeatures = await getChromeStatusFeatures(id);

    // The feature might have moved from somewhere else and chrome status might still have the old ID.
    // Check for this and include those entries as well.
    const originalId = maybeGetOriginalIdForMovedFeature(id);
    if (originalId) {
      const originalChromeStatusFeatures = await getChromeStatusFeatures(originalId);
      chromeStatusFeatures.push(...originalChromeStatusFeatures);
    }

    if (chromeStatusFeatures.length > 0) {
      mapping[id] = chromeStatusFeatures;
    }

    // Write after each feature to avoid losing progress on network errors.
    await fs.writeFile(OUTPUT_FILE, JSON.stringify(mapping, null, 2));
  }
}

main();
