// This script gets the latest developer signals data from the web-platform-dx/developer-signals repo
// and updates the local copy in mappings/developer-signals.json.

import path from "path";
import fs from "fs/promises";

// The web-platform-dx/developer-signals repo already produces the data we need at this URL.
// All this script does is to update the data in our local copy.
const SIGNALS_DATA = "https://web-platform-dx.github.io/developer-signals/web-features-signals.json";

const OUTPUT_FILE = path.join(import.meta.dirname, "../mappings/developer-signals.json");

async function main() {
  console.log("Getting developer signals...");
  const response = await fetch(SIGNALS_DATA);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${SIGNALS_DATA}: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();

  console.log(`Writing mapping to ${OUTPUT_FILE}...`);
  await fs.writeFile(OUTPUT_FILE, JSON.stringify(data, null, 2));
}

main();
