// This script fetches the latest interop mapping data from the web-platform-tests/interop repository
// and writes it to a local file named interop.json.

import fs from "fs/promises";
import path from "path";

const INPUT_DATA = "https://raw.githubusercontent.com/web-platform-tests/interop/refs/heads/main/web-features.json";
const OUTPUT_FILE = "../mappings/interop.json";

async function main() {
  // Fetch the input data.
  console.log(`Fetch interop mapping data from ${INPUT_DATA}`);
  const response = await fetch(INPUT_DATA);
  if (!response.ok) {
    throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();

  // Massage the data to match the expected format.
  const mapping = {};

  for (const year in data) {
    const yearData = data[year];
    for (const label in yearData) {
      const features = yearData[label];
      for (const id of features) {
        if (!mapping[id]) {
          mapping[id] = [];
        }

        mapping[id].push({
          year: parseInt(year, 10),
          label,
          url: `https://wpt.fyi/interop-${year}?feature=${label}`
        });
      }
    }
  }

  // Write the data to the output file.
  const fileName = path.join(import.meta.dirname, OUTPUT_FILE);
  console.log(`Write mapping data to ${fileName}`);
  await fs.writeFile(fileName, JSON.stringify(mapping, null, 2));
}

main();
