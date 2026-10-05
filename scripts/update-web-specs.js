// This script updates web-specs.json from browser-compat-data and web-specs.
// It looks at specs targeted by the spec_url field of BCD keys that compose a
// feature and stores the specs shortnames by web-features ID.
// In cases where BCD targets a series URL (e.g., css-color instead of
// css-color-4), the mapping is done with the current spec in the series.

import { features } from 'web-features';
import bcd from '@mdn/browser-compat-data' with { type: 'json' };
import webSpecs from 'web-specs/index.json' with { type: 'json' };
import path from "path";
import fs from "fs/promises";

const OUTPUT_FILE = path.join(import.meta.dirname, "../mappings/web-specs.json");

/**
 * Return true when the given web-specs entry is a good match for the given
 * list of URLs. Used to map BCD `spec_url` properties to web-specs.
 *
 * Note: When a URL targets the series URL, we'll consider that it is a good
 * match if the given web-specs entry is the current specification in that
 * series.
 */
function isRelevantSpec(webSpecsEntry, specUrlsFromBCD) {
  return specUrlsFromBCD.find(url => url.startsWith(webSpecsEntry.nightly?.url)) ||
      specUrlsFromBCD.find(url => url.startsWith(webSpecsEntry.release?.url)) ||
      specUrlsFromBCD.find(url => url.startsWith(webSpecsEntry.url)) ||
      (webSpecsEntry.shortname === webSpecsEntry.series.currentSpecification && specUrlsFromBCD.find(url => url.startsWith(webSpecsEntry.series?.nightlyUrl))) ||
      (webSpecsEntry.shortname === webSpecsEntry.series.currentSpecification && specUrlsFromBCD.find(url => url.startsWith(webSpecsEntry.series?.releaseUrl)));
}


/**
 * Helper function to retrieve BCD support data from a key path such as
 * `css.properties.display.grid`.
 */
function getBcdKey(key) {
  const keyPath = key.split('.');
  let currKey = bcd;
  for (const level of keyPath) {
    if (!level) {
      break;
    }
    currKey = currKey[level];
    if (!currKey) {
      throw new Error(`BCD key "${key}" does not exist`);
    }
  }
  if (!currKey.__compat) {
    throw new Error(`BCD key "${key}" does not have compat data`);
  }
  return currKey.__compat;
}

async function main() {
  const mapping = {};
  for (const id in features) {
    const specs = webSpecs
      .filter(spec =>
        features[id].compat_features?.some(bcdKey => {
          const support = getBcdKey(bcdKey);
          if (support?.spec_url) {
            const urls = Array.isArray(support.spec_url) ?
              support.spec_url :
              [support.spec_url];
            return isRelevantSpec(spec, urls);
          }
        })
      )
      .map(spec => spec.shortname)
      .sort();
    if (specs.length > 0) {
      mapping[id] = specs;
    }
  }

  await fs.writeFile(OUTPUT_FILE, JSON.stringify(mapping, null, 2));
}

main();