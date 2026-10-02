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
function isRelevantSpec(spec, urls) {
  return urls.find(url => url.startsWith(spec.nightly?.url)) ||
      urls.find(url => url.startsWith(spec.release?.url)) ||
      urls.find(url => url.startsWith(spec.url)) ||
      (spec.shortname === spec.series.currentSpecification && urls.find(url => url.startsWith(spec.series?.nightlyUrl))) ||
      (spec.shortname === spec.series.currentSpecification && urls.find(url => url.startsWith(spec.series?.releaseUrl)));
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