import fs from "fs/promises";
import path from "path";
import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { glob } from "glob";
import { fileURLToPath } from "url";
import { features } from "web-features";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  console.log("Linting mapping files against schemas...");

  const ajv = new Ajv({ allErrors: true });
  addFormats(ajv);

  const schemaPath = path.join(__dirname, "../schemas.json");
  const mainSchema = JSON.parse(await fs.readFile(schemaPath, "utf-8"));
  ajv.addSchema(mainSchema, "schemas.json");

  const mappingFiles = await glob(path.join(__dirname, "../mappings/*.json"));

  const schemaKeys = new Set(Object.keys(mainSchema.properties));
  const mappingFileKeys = new Set(
    mappingFiles.map((file) => path.basename(file, ".json"))
  );
  for (const schemaKey of schemaKeys) {
    if (!mappingFileKeys.has(schemaKey)) {
      console.warn(
        `
Warning: Schema definition exists for "${schemaKey}" but no corresponding file was found in mappings/.`
      );
    }
  }

  let hasErrors = false;

  for (const file of mappingFiles) {
    const fileKey = path.basename(file, ".json");
    console.log(`
Linting ${file}...`);

    const schemaRef = mainSchema.properties[fileKey]?.$ref;
    if (!schemaRef) {
      console.warn(
        `  No schema definition found for ${fileKey} in schemas.json, skipping.`
      );
      continue;
    }

    const validator = ajv.getSchema(`schemas.json${schemaRef}`);
    if (!validator) {
      console.error(
        `  Could not find or compile schema for ${fileKey} with ref ${schemaRef}`
      );
      hasErrors = true;
      continue;
    }

    const data = JSON.parse(await fs.readFile(file, "utf-8"));

    if (!validator(data)) {
      hasErrors = true;
      console.error(`  Validation errors in ${file}:`);
      for (const error of validator.errors) {
        console.error(`    - ${error.instancePath || "root"}: ${error.message}`);
      }
    } else {
      console.log(`  ${file} is valid.`);
    }

    const featureIds = Object.keys(data);
    for (const featureId of featureIds) {
      if (!features[featureId]) {
        hasErrors = true;
        console.error(
          `  Error: Feature ID "${featureId}" does not exist in web-features.`
        );
      }
    }
  }

  if (hasErrors) {
    console.error("\n\nLinting failed with errors.");
    process.exit(1);
  }

  console.log("\n\nAll mapping files are valid.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
