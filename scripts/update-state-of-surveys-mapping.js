// This script retrieves the latest survey data from the Devographics surveys repository
// and extracts web feature references from the survey JSON files.

import fs from "fs/promises";
import path from "path";
import { execSync } from "child_process";
import { glob } from "glob";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const REPO = "https://github.com/Devographics/surveys";
const TEMP_FOLDER = "surveys";
const OUTPUT_FILE = path.join(import.meta.dirname, "../mappings/state-of-surveys.json");
const SURVEYS_TO_INCLUDE = ["state_of_css", "state_of_html", "state_of_js"];
const SURVEY_DOMAINS = {
  state_of_css: "stateofcss.com/en-US",
  state_of_html: "stateofhtml.com/en-US",
  state_of_js: "stateofjs.com/en-US",
};
const SURVEY_NAMES = {
  state_of_css: "State of CSS",
  state_of_html: "State of HTML",
  state_of_js: "State of JS",
};

function extractWebFeatureReferences(data) {
  const webFeatureRefs = [];

  function walk(object, objectPath = []) {
    if (!object) {
      return;
    }

    if (Array.isArray(object)) {
      for (let i = 0; i < object.length; i++) {
        walk(object[i], [...objectPath, i]);
      }
      return;
    }

    if (typeof object !== "object") {
      return;
    }

    if (object.webFeature) {
      // Only consider web-feature references that are inside a
      // survey object: {dataAPI: {surveys: {...}}}
      if (objectPath[0] === "dataAPI" && objectPath[1] === "surveys") {
        webFeatureRefs.push({ objectPath, object });
      }
    }

    for (const key in object) {
      walk(object[key], [...objectPath, key]);
    }
  }

  walk(data);

  return webFeatureRefs;
}

function extractSurveyTitleAndUrl(path) {
  const survey = path[2];
  const edition = path[3];
  const year = edition.slice(-4);
  const question = path[4];
  const subQuestion = path[5];

  let url = `https://${year}.${SURVEY_DOMAINS[survey]}/${question}/#${subQuestion}`

  // Some quirks of State of surveys.
  url = url.replace("reading_list/reading_list", "features/reading_list");
  url = url.replace("/reading_list/#reading_list", "/features/#reading_list");
  url = url.replace("en-US/web_components/", "en-US/features/web_components/");
  url = url.replace("en-US/mobile_web_apps", "en-US/features/mobile-web-apps");
  url = url.replace("/interactivity", "/features/interactivity");

  if (survey in SURVEY_DOMAINS) {
    return {
      name: `${SURVEY_NAMES[survey]} ${year}`,
      url,
      question,
      subQuestion,
      survey,
      edition
    };
  }

  return null;
}

async function isSurveyPublished(survey, edition) {
  const configPath = path.join(__dirname, TEMP_FOLDER, survey, edition, "config.yml");

  try {
    const content = await fs.readFile(configPath, "utf-8");
    return content.includes("resultsStatus: 3");
  } catch (e) {
    console.error(`Error reading config file ${configPath}: ${e.message}`);
    return false;
  }
}

async function main() {
  // Create a temp folder for the survey data.
  console.log(`Create a temporary folder to clone the surveys repository.`);
  const tempFolder = path.join(__dirname, TEMP_FOLDER);
  await fs.mkdir(tempFolder, { recursive: true });

  // Clone the surveys repo.
  console.log(`Cloning ${REPO} into ${tempFolder} ...`);
  execSync(`git clone --depth 1 ${REPO} ${tempFolder}`);

  // Find all of the *.json files in sub-folders using glob.
  console.log(`Search for JSON files in ${tempFolder}.`);
  const files = glob.sync(`${tempFolder}/**/*.json`);

  const mapping = {};

  for (const file of files) {
    if (!SURVEYS_TO_INCLUDE.some((survey) => file.includes(survey))) {
      continue;
    }

    let data = null;

    console.log(`Reading ${file}...`);
    try {
      const content = await fs.readFile(file, "utf-8");
      data = JSON.parse(content);
    } catch (e) {
      console.error(`Error reading ${file}: ${e.message}`);
      continue;
    }

    console.log(`Extracting web feature references from ${file}`);
    const refs = extractWebFeatureReferences(data);
    for (const ref of refs) {
      const { objectPath, object } = ref;
      const { survey, edition, name, url, question, subQuestion } = extractSurveyTitleAndUrl(objectPath);
      const featureId = object.webFeature.id;

      if (!mapping[featureId]) {
        mapping[featureId] = [];
      }

      // Find if there's already a reference to the exact same survey url.
      if (mapping[featureId].some((ref) => ref.url === url)) {
        continue;
      }

      // Verify that the survey results have been published.
      if (!(await isSurveyPublished(survey, edition))) {
        continue;
      }

      mapping[featureId].push({ name, url, question, subQuestion, path: objectPath.join(".") });
    }
  }

  // Delete the folder.
  console.log(`Delete temporary folder ${tempFolder}.`);
  await fs.rm(tempFolder, { recursive: true });

  // Write the data to the output file.
  console.log(`Write the data to ${OUTPUT_FILE}.`);
  await fs.writeFile(OUTPUT_FILE, JSON.stringify(mapping, null, 2));
}

main();
