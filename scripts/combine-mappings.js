import fs from "fs/promises";
import path from "path";
import { glob } from "glob";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  console.log("Combining mapping files...");

  const mappingFiles = await glob(path.join(__dirname, "../mappings/*.json"));

  const combinedData = {};

  for (const file of mappingFiles) {
    const fileKey = path.basename(file, ".json");
    const data = JSON.parse(await fs.readFile(file, "utf-8"));
    combinedData[fileKey] = data;
  }

  const outputFile = path.join(__dirname, "../web-features-mappings.combined.json");
  await fs.writeFile(outputFile, JSON.stringify(combinedData, null, 2));

  console.log(`Combined data written to ${outputFile}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});