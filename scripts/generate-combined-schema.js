import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMAS_FILE = path.join(__dirname, "../schemas.json");
const OUTPUT_FILE = path.join(__dirname, "../combined-schema.gen.json");

async function main() {
  console.log("Generating combined schema...");

  const schemas = JSON.parse(await fs.readFile(SCHEMAS_FILE, "utf-8"));

  const valueSchema = {
    type: "object",
    properties: {},
    additionalProperties: false,
  };

  // For each mapping file, find the schema for a feature's value within that
  // file and add it to the combined schema.
  for (const fileKey in schemas.properties) {
    const fileSchemaRef = schemas.properties[fileKey].$ref;
    const fileSchemaDefName = fileSchemaRef.substring(fileSchemaRef.lastIndexOf("/") + 1);
    const fileSchema = schemas.definitions[fileSchemaDefName];
    const valueSchemaRef = fileSchema.patternProperties[".*"].$ref;
    
    valueSchema.properties[fileKey] = {
      $ref: valueSchemaRef,
    };
  }

  const combinedSchema = {
    "$schema": "http://json-schema.org/draft-07/schema#",
    title: "Combined Web Feature Mappings Data",
    description: "Schema for combined-data.json.",
    type: "object",
    definitions: schemas.definitions,
    additionalProperties: valueSchema,
  };

  await fs.writeFile(OUTPUT_FILE, JSON.stringify(combinedSchema, null, 2));

  console.log(`Combined schema written to ${OUTPUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
