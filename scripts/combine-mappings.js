import fs from "fs/promises";
import path from "path";
import { glob } from "glob";
import { fileURLToPath } from "url";
import Ajv from "ajv";
import addFormats from "ajv-formats";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_FILE = path.join(__dirname, "../mappings/combined-data.json");
const SCHEMA_FILE = path.join(__dirname, "../combined-schema.gen.json");

async function main() {
  console.log("Combining mapping files...");

  // Find all JSON files in the mappings directory.
  const mappingFilesPattern = path.join(__dirname, "../mappings/*.json").replace(/\\/g, "/");
  const ignoredPattern = path.join(__dirname, "../mappings/combined-data.json").replace(/\\/g, "/");
  const mappingFiles = await glob(mappingFilesPattern, { ignore: ignoredPattern });

  const combinedData = {};

  // Go over each JSON file.
  for (const file of mappingFiles) {
    const fileKey = path.basename(file, ".json");
    const fileData = JSON.parse(await fs.readFile(file, "utf-8"));

    console.log(`Processing ${fileKey} (${Object.keys(fileData).length} entries)...`);

    // Merge the file's data into the combined file.
    for (const featureId in fileData) {
      if (!combinedData[featureId]) {
        combinedData[featureId] = {};
      }

      combinedData[featureId][fileKey] = fileData[featureId];
    }
  }

  // Sort the data by feature id, so changes are easier to track.
  const sortedCombinedData = {};
  Object.keys(combinedData).sort().forEach((key) => {
    sortedCombinedData[key] = combinedData[key];
  });

  // Validate the combined data against the schema.
  console.log("Validating combined data...");
  const schema = JSON.parse(await fs.readFile(SCHEMA_FILE, "utf-8"));
  const ajv = new Ajv();
  addFormats(ajv);
  const validate = ajv.compile(schema);
  const valid = validate(sortedCombinedData);
  if (!valid) {
    console.error("Combined data is invalid:");
    console.error(validate.errors);
    process.exit(1);
  }
  console.log("Combined data is valid.");

  // Write the combined data to the output file.
  console.log(`Writing combined data to ${OUTPUT_FILE}`);  
  await fs.writeFile(OUTPUT_FILE, JSON.stringify(sortedCombinedData, null, 2));

  console.log(`Combined data written to ${OUTPUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
