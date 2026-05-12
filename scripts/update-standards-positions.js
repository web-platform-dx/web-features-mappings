// This script updates the standards-positions.json data file with the
// positions and concerns which browser vendors might have about web
// features.

// The standard-positions.json file is structured as an object with keys
// that are web-features IDs, and values that are arrays of position
// objects.
//
// {
//    "<feature-id>": [
//      {...}
//   ]
// }
//
// Each position object is structured as follows:
//
// {
//   vendor: "mozilla" | "apple",
//   url: "<url>", // The URL of the vendor's issue about the feature.
//   position: "<position>", // The vendor's position on the feature.
//   concerns: ["<concern>"], // An array of concerns the vendor has.
// }
//
// For example:
//
// {
//   "container-style-queries": [
//     {
//       "vendor": "mozilla",
//       "url": "https://github.com/mozilla/standards-positions/issues/686",
//       "position": "positive"
//     },
//     {
//       "vendor": "apple",
//       "url": "https://github.com/WebKit/standards-positions/issues/57",
//       "position": "support"
//     }
//   ]
// }

// To add a new position:
// The vendor and url fields are the only required fields and you must add
// them manually to this file.
// The script will then fetch the position and concerns from the vendor's
// issue and update the position and concerns fields accordingly.

import { features } from "web-features";
import fs from "fs/promises";
import positions from "../mappings/standards-positions.json" with { type: "json" };
import path from "path";

const OUTPUT_FILE = path.join(import.meta.dirname, "../mappings/standards-positions.json");
const MOZILLA_DATA_FILE =
  "https://raw.githubusercontent.com/mozilla/standards-positions/refs/heads/gh-pages/merged-data.json";
const WEBKIT_DATA_FILE =
  "https://raw.githubusercontent.com/WebKit/standards-positions/main/summary.json";

let mozillaData = null;
let webkitData = null;

async function getMozillaData() {
  if (!mozillaData) {
    const response = await fetch(MOZILLA_DATA_FILE);
    mozillaData = await response.json();
  }

  return mozillaData;
}

async function getMozillaPosition(url) {
  const data = await getMozillaData();

  const issueId = url.split("/").pop();
  const issue = data[issueId];
  if (!issue) {
    return { position: "", concerns: [] };
  }

  return {
    position: issue.position || "",
    concerns: issue.concerns,
  };
}

async function getWebkitData() {
  if (!webkitData) {
    const response = await fetch(WEBKIT_DATA_FILE);
    webkitData = await response.json();
  }

  return webkitData;
}

async function getWebkitPosition(url) {
  const data = await getWebkitData();

  for (const position of data) {
    if (position.id === url) {
      return {
        position: position.position || "",
        concerns: position.concerns || [],
      };
    }
  }

  return { position: "", concerns: [] };
}

async function getPosition(vendor, url) {
  switch (vendor) {
    case "apple":
      return await getWebkitPosition(url);
    case "mozilla":
      return await getMozillaPosition(url);
  }
}

async function main() {
  // Update the positions and concerns for the features that have vendor URLs.
  for (const featureId in positions) {
    if (!features[featureId]) {
      console.warn(`Feature ${featureId} not found in web-features.`);
      continue;
    }

    const featurePositions = positions[featureId];

    for (const position of featurePositions) {
      console.log(
        `Updating ${position.vendor}'s standards position for ${featureId}...`
      );

      const data = await getPosition(
        position.vendor,
        position.url
      );

      position.position = data.position;
      position.concerns = data.concerns;
    }
  }

  // Store the updated positions back in the file.
  await fs.writeFile(OUTPUT_FILE, JSON.stringify(positions, null, 2));
}

main();
