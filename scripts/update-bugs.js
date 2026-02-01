// This scripts updates the bugs.json mapping file.
// It uses multiple data sources to search for bugs that reference certain web-features.
//
// Firefox bugzilla: some bugs on bugzilla have the web-feature ID mentioned in the
// "cf_user_story" field, as a string like "web-feature : <feature-id>".
// We can search for these bugs using the bugzilla REST API.
//
// BCD: some BCD keys have a `impl_url` property which points to a bugzilla bug.
// We can use these links to find bugs related to web-features.

import { features } from "web-features";
import bcd from "@mdn/browser-compat-data" with { type: "json" };
import path from "path";
import fs from "fs/promises";

const OUTPUT_FILE = path.join(import.meta.dirname, "../mappings/bugs.json");

async function getAllFirefoxBugzillaMappedBugs() {
  const BUGZILLA_API_URL = "https://bugzilla.mozilla.org/rest/bug";
  const QUERY_PARAMS = "?o1=regexp&v1=^web-feature\\s*%3A\\s*[\\w-_]%2B\\s*%24&f1=cf_user_story&include_fields=id,cf_user_story";

  console.log("Fetching bugs from Bugzilla...");
  const response = await fetch(BUGZILLA_API_URL + QUERY_PARAMS);
  if (!response.ok) {
    throw new Error(`Failed to fetch bugs from Bugzilla: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();

  const bugsMappings = {};

  for (const bug of data.bugs) {
    // Check that the bug indeed has a parseable web-feature ID in the cf_user_story field.
    const match = bug.cf_user_story.match(/web-feature\s*:\s*([\w-_]+)/);
    if (match) {
      const id = match[1].toLowerCase();
      // Check that the web-features package has this feature ID.
      if (features[id]) {
        bugsMappings[id] = bugsMappings[id] || [];
        bugsMappings[id].push({
          url: `https://bugzil.la/${bug.id}`
        });
      }
    }
  }

  return bugsMappings;
}

async function getChromiumBugForFeature(id) {
  const CHROME_STATUS_API_URL = `https://chromestatus.com/api/v0/features?q=web_feature_id=${id}`;

  console.log(`Fetching feature data from Chrome Status API for feature ID: ${id}...`);
  const response = await fetch(CHROME_STATUS_API_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch feature data from Chrome Status API: ${response.status} ${response.statusText}`);
  }

  let text = await response.text();
  text = text.substring(4);
  const data = JSON.parse(text);

  const bugURLs = [];

  for (const feature of data.features || []) {
    if (feature.bug_url) {
      bugURLs.push(feature.bug_url);
    }
  }

  return bugURLs;
}

async function getAllChromiumMappedBugs() {
  const bugsMappings = {};

  for (const id in features) {
    const feature = features[id];
    
    if (feature.status && feature.status.support && !feature.status.support.chrome) {
      const bugURLs = await getChromiumBugForFeature(id);

      if (bugURLs.length > 0) {
        bugsMappings[id] = bugURLs.map(url => ({ url }));
      }
    }
  }

  return bugsMappings;
}

function getBugURLsFromBCDKeys() {
  const bugsMappings = {};

  // Go over each feature.
  for (const id in features) {
    console.log(`Processing BCD data for feature ID: ${id}...`);
    const feature = features[id];
    const keys = feature.compat_features || [];

    // Go over each BCD key associated with this feature.
    for (const key of keys) {
      const keyParts = key.split(".");

      // Get the BCD data for this key.
      let data = bcd;
      for (const part of keyParts) {
        if (!data || !data[part]) {
          console.warn(
            `No BCD data for ${key}. Check if the web-features and browser-compat-data dependencies are in sync.`
          );
          data = null;
          break;
        }
        data = data[part];
      }

      const support = data?.__compat?.support;
      for (const browserId in support) {
        const browserSupportData = Array.isArray(support[browserId]) ? support[browserId] : [support[browserId]];
        for (const entry of browserSupportData) {
          if (entry.impl_url) {
            if (!bugsMappings[id]) {
              bugsMappings[id] = {};
            }

            if (!bugsMappings[id][browserId]) {
              bugsMappings[id][browserId] = [];
            }

            const urls = Array.isArray(entry.impl_url) ? entry.impl_url : [entry.impl_url];
            bugsMappings[id][browserId].push(...urls);
            bugsMappings[id][browserId] = [...new Set(bugsMappings[id][browserId])];
          }
        }
      }
    }
  }

  return bugsMappings;
}

async function main() {
  const bugzillaBugs = await getAllFirefoxBugzillaMappedBugs();
  const chromeStatusBugs = await getAllChromiumMappedBugs();
  const bugsFromBCDKeys = getBugURLsFromBCDKeys();

  // Combine all bug sources into a single mapping object.
  const mapping = {};

  // Add Firefox Bugzilla bugs.
  for (const featureId in bugzillaBugs) {
    if (!mapping[featureId]) mapping[featureId] = {};
    if (!mapping[featureId].firefox) mapping[featureId].firefox = [];
    for (const bug of bugzillaBugs[featureId]) {
      mapping[featureId].firefox.push(bug.url);
    }
  }

  // Add Chrome Status bugs.
  for (const featureId in chromeStatusBugs) {
    if (!mapping[featureId]) mapping[featureId] = {};
    if (!mapping[featureId].chrome) mapping[featureId].chrome = [];
    for (const bug of chromeStatusBugs[featureId]) {
      mapping[featureId].chrome.push(bug.url);
    }
  }

  // Add BCD bugs (already organized by browser).
  for (const featureId in bugsFromBCDKeys) {
    if (!mapping[featureId]) mapping[featureId] = {};
    for (const browserId in bugsFromBCDKeys[featureId]) {
      if (!mapping[featureId][browserId]) mapping[featureId][browserId] = [];
      for (const url of bugsFromBCDKeys[featureId][browserId]) {
        mapping[featureId][browserId].push(url);
      }
    }
  }

  // De-duplicate URLs for each feature/browser combination.
  for (const featureId in mapping) {
    for (const browserId in mapping[featureId]) {
      mapping[featureId][browserId] = [...new Set(mapping[featureId][browserId])];
    }
  }

  console.log(`Write mapping data to ${OUTPUT_FILE}`);
  await fs.writeFile(OUTPUT_FILE, JSON.stringify(mapping, null, 2));
}

main();
