// This script clones the WPT repo, and then finds all the WEB_FEATURES.yml files
// in the repo. It then parses these files to extract web features
// and writes the data to a local file named wpt.json.
// The mapping may seem overly simple: { "<feature-id>": { "url": "https://wpt.fyi/results?q=feature:<feature-id>" } }
// but that's because there isn't (for now) any additional data to add. And the existance
// of a mapping for a given feature id, means that there are WPT tests for that feature.
// Feature IDs that are missing from the mapping file are features that don't have any WPT tests.

import fs from "fs/promises";
import path from "path";
import { execSync } from "child_process";
import { glob } from 'glob';
import yaml from 'js-yaml';
import { fileURLToPath } from "url";
import { features } from "web-features";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TEMP_FOLDER = "wpt-repo";
const REPO = "https://github.com/web-platform-tests/wpt.git";
const BRANCH = "master";
const WEB_FEATURES_FILE_NAME = "WEB_FEATURES.yml";
const OUTPUT_FILE = path.join(import.meta.dirname, "../mappings/wpt.json");

async function findWebFeaturesFiles() {
  try {
    console.log(`Searching for ${WEB_FEATURES_FILE_NAME} files in the ${TEMP_FOLDER} directory...`);
    const pattern = `**/${WEB_FEATURES_FILE_NAME}`;
    const files = await glob(pattern, {
      cwd: path.join(__dirname, TEMP_FOLDER)
    });

    if (files.length === 0) {
      console.log(`No ${WEB_FEATURES_FILE_NAME} files found in the ${TEMP_FOLDER} directory.`);
      return [];
    }

    return files;
  } catch (error) {
    console.error(`Error searching for ${WEB_FEATURES_FILE_NAME} files:`, error);
    return [];
  }
}

async function parseYamlFile(file) {
  try {
    console.log(`Parsing file: ${file}.`);
    const content = await fs.readFile(file, 'utf8');
    const parsedContent = yaml.load(content);

    return parsedContent;
  } catch (error) {
    console.error(`Error reading or parsing file ${file}:`, error.message);
    throw new Error(`Failed to parse YAML file: ${file}`);
  }
}

async function main() {
  // Create a temp folder for the wpt repo.
  console.log(`Create a temporary folder to clone the wpt repository.`);
  const tempFolder = path.join(__dirname, TEMP_FOLDER);
  await fs.mkdir(tempFolder, { recursive: true });

  // Clone the wpt repo.
  console.log(`Cloning ${REPO} into ${tempFolder} ...`);
  execSync(`git clone --depth 1 ${REPO} --branch ${BRANCH} --single-branch ${tempFolder}`);

  // Find all web features files in the repo.
  const webFeatureFiles = await findWebFeaturesFiles();
  console.log(`Found ${webFeatureFiles.length} ${WEB_FEATURES_FILE_NAME} file(s) in the repo.`);

  const mapping = {};

  for (const file of webFeatureFiles) {
    const parsedContent = await parseYamlFile(path.join(TEMP_FOLDER, file));

    for (const feature of parsedContent.features) {
      if (!features[feature.name]) {
        console.warn(`Feature ID "${feature.name}" in ${file} is not a valid web-features ID, skipping.`);
        continue;
      }

      mapping[feature.name] = {
        url: `https://wpt.fyi/results?q=feature:${feature.name}`
      };
    }
  }

  console.log(`\nSuccessfully parsed ${webFeatureFiles.length} files.`);

  // Sort the mapping by feature id.
  const sortedMapping = {};
  Object.keys(mapping).sort().forEach((key) => {
    sortedMapping[key] = mapping[key];
  });

  // Write the web features to a JSON file
  console.log(`Writing the data to ${OUTPUT_FILE}`);
  await fs.writeFile(OUTPUT_FILE, JSON.stringify(sortedMapping, null, 2));

  // Delete the temp folder.
  console.log(`Delete temporary folder ${tempFolder}.`);
  await fs.rm(tempFolder, { recursive: true });
}

main();
