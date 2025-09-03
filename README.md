# web-features-mappings

## Mapping external data to web-features IDs

The [web-features](https://github.com/web-platform-dx/web-features) project provides the minimum amount of data that's needed to support [Baseline](https://web-platform-dx.github.io/web-features/) and otherwise acts as a repository of unique feature IDs, which other projects can point to.

This was done for maintainability reasons, to avoid adding a lot of third-party data to the web-features project to support other use cases than Baseline. This means that third-party data sources can map their own data to web-features IDs, and are responsible for maintaining the mapping.

Examples of data sources which map to web-features include:

* [web-platform-tests](https://wpt.fyi), which maps certain tests to web-features via search keywords, e.g. [the `feature:grid` keyword](https://wpt.fyi/results/?q=feature:grid).
* [browser-compat-data](https://github.com/mdn/browser-compat-data/), which maps BCD keys to web-features via tags, e.g. [the `web-features:selection-api` tag](https://github.com/search?q=repo%3Amdn%2Fbrowser-compat-data%20web-features%3Aselection-api&type=code).
* Chrome Platform Status' [Web features usage metrics](https://chromestatus.com/metrics/webfeature/popularity), which maps Chrome page loads to web-features.

## Adding new mappings

If you maintain data about features of the web platform, consider creating a resource which provides a mapping between your data and IDs from the web-features project and [let us know about it](https://github.com/web-platform-dx/web-features-mappings/issues).

## About the files in this repository

There are two types of mapping files in this repository, under the `/mappings/` folder:

* Files for data sources which do not yet map to web-features IDs.
* Files for data sources which already map to web-features IDs.

### Data sources which don't yet map to web-features IDs

Currently, not all the data sources which are helpful to web developers and/or browser engineers are mapped to web-features IDs. Because these data sources are used on the [Web platform features explorer website](https://web-platform-dx.github.io/web-features-explorer/) but a mapping did not exist, we maintain files in this repository to do the mapping instead.

Examples of data sources which are mapped in this repository:

* Origin trials
* MDN documentation
* Standard positions

### Data sources which already map to web-features IDs

Data sources which already maintain a mapping to web-features on their own still have mapping files in this repository. These files are typically updated automatically, on a schedule, for convenience. This way, this repository can be used to retrieve all currently known web-features-mapped data, whether the mapping is maintained here or elsewhere.

Examples of data sources which already map to web-features IDs and for which we automatically update files in this repository:

* Interop focus areas.
* Chrome use counters.
* web-platform-tests.

## The scripts folder

The `/scripts/` folder contains the JavaScript files that are responsible for updating the mapping files.

To run these scripts:

1. `cd scripts`
1. `npm install`
1. `node <the-script-you-want-to-run>.js`

## Mapping format

The mappings are JSON files that are formatted as follows:

```json
{
  "a web-features id": <data that's specific to this mapping file>
}
```

## Combined data

The `combine` script generates a `web-features-mappings.combined.json` file in the root of the repository. This file contains all the mapping data from the `mappings` folder, combined into a single file.

The format of the combined file is as follows:

```json
{
  "chrome-use-counters": { ... },
  "interop": { ... },
  ...
}
```

## TODO

* Add mapping to origin trials.
* Add mapping to TAG reviews.
* Add mapping to chromestatus entries (via spec URLs?)
* Try to find a better way than matching on spec URLs.
* Find a way to detect new standards positions automatically.
* Sometimes MDN doc pages get removed (:target-within was removed recently). Find a way to remove the mapping.
* Publish consolidated data to NPM.
* Also create releases on GitHub so consumers can download JSON from there too.
* Migrate the explorer to use this data instead of its own.
