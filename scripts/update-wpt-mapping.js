// This script clones the WPT repo, and then finds all the WEB_FEATURES.yml files
// in the repo. It then parses these files to extract web features and their test paths
// and writes the data to a local file named wpt.json.

import fs from "fs/promises";
import path from "path";
import { execSync } from "child_process";
import { glob } from 'glob';
import yaml from 'js-yaml';
import { fileURLToPath } from "url";

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
  // // Create a temp folder for the wpt repo.
  // console.log(`Create a temporary folder to clone the wpt repository.`);
  // const tempFolder = path.join(__dirname, TEMP_FOLDER);
  // await fs.mkdir(tempFolder, { recursive: true });

  // // Clone the wpt repo.
  // console.log(`Cloning ${REPO} into ${tempFolder} ...`);
  // execSync(`git clone --depth 1 ${REPO} --branch ${BRANCH} --single-branch ${tempFolder}`);

  // Find all web features files in the repo.
  const webFeatureFiles = await findWebFeaturesFiles();
  console.log(`Found ${webFeatureFiles.length} ${WEB_FEATURES_FILE_NAME} file(s) in the repo.`);

  const mapping = {};

  for (const file of webFeatureFiles) {
    const dirName = path.dirname(file);
    const parsedContent = await parseYamlFile(path.join(TEMP_FOLDER, file));

    for (const feature of parsedContent.features) {
      if (!mapping[feature.name]) {
        mapping[feature.name] = {
          url: `https://wpt.fyi/results?q=feature:${feature.name}`,
          tests: new Set()
        };
      }

      for (const testFile of feature.files) {
        mapping[feature.name].tests.add(path.join(dirName, testFile).replaceAll(path.sep, '/'));
      }
    }
  }

  // Convert the tests Set to an Array for each feature.
  for (const featureName in mapping) {
    mapping[featureName].tests = Array.from(mapping[featureName].tests);
  }

  console.log(`\nSuccessfully parsed ${webFeatureFiles.length} files.`);

  // Write the web features to a JSON file
  console.log(`Writing the data to ${OUTPUT_FILE}`);
  await fs.writeFile(OUTPUT_FILE, JSON.stringify(mapping, null, 2));

  // Delete the temp folder.
  // console.log(`Delete temporary folder ${tempFolder}.`);
  // await fs.rm(tempFolder, { recursive: true });
}

main();
