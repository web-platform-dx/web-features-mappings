import fs from "fs/promises";
import path from "path";
import { glob } from "glob";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  console.log("Combining mapping files...");

  const mappingFilesPattern = path.join(__dirname, "../mappings/*.json").replace(/\\/g, "/");
  const mappingFiles = await glob(mappingFilesPattern);

  const combinedData = {};

  for (const file of mappingFiles) {
    const fileKey = path.basename(file, ".json");
    const fileData = JSON.parse(await fs.readFile(file, "utf-8"));

    for (const featureId in fileData) {
      if (!combinedData[featureId]) {
        combinedData[featureId] = {};
      }

      combinedData[featureId][fileKey] = fileData[featureId];
    }
  }

  const outputFile = path.join(__dirname, "../web-features-mappings.combined.json");
  await fs.writeFile(outputFile, JSON.stringify(combinedData, null, 2));

  console.log(`Combined data written to ${outputFile}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
