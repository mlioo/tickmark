# Mobile Companion Architecture

The companion app is a standalone sibling project at `OpenTopo-Mobile/` and targets iOS and Android from one React Native codebase. Its local content generator reads from `../OpenTopo/content/areas` but never writes to the web project.

## Offline boundary

SQLite is the source of truth on device. The schema separates replaceable public topo tables from private log tables:

```text
replaceable topo                    private climbing data
topo_areas                          sessions
topo_boulders                       attempts
topo_problems                       problem_notes
        stable IDs <---------------------+
```

Attempts intentionally keep stable area, boulder, and problem IDs without foreign-key deletion rules into the topo tables. A topo update can therefore replace the public guide without erasing historical climbing records. Removed problems can still appear in an export using their stored IDs.

## Network boundary

There is no automatic or background network task. A user can explicitly check GitHub for the latest commit touching `content/areas` in the public [`mlioo/opentopo`](https://github.com/mlioo/opentopo) repository, then download and assemble that area/boulder JSON into the local SQLite topo tables. `src/network/opentopo.ts` validates HTTPS and permits only `api.github.com` and `raw.githubusercontent.com`. Bundled topo photos are not re-downloaded; update sync refreshes guide metadata and problem lines for assets already in the app.

The map uses a live pan-and-zoom basemap with verified bundled latitude/longitude plotted as custom markers. Approximate fallback pins are deliberately omitted. iOS uses Apple Maps (MapKit) through `react-native-maps`. Android uses MapLibre Native with OpenStreetMap vector tiles from OpenFreeMap (no API key). App JavaScript does not fetch third-party map-tile hosts; each platform loads basemap imagery through its native maps SDK. After a user action, the device's foreground GPS position is added in memory and is never stored.

`scripts/sync-topo.mjs` copies all referenced topo photos into the mobile project and generates `src/data/topoAssets.ts`, whose static `require` calls let Metro package those images for both platforms. Problem lines remain normalized percentage coordinates and are drawn over the original image aspect ratio. The current originals are intentionally preserved for topo fidelity; before store distribution they should be resized and split into checksum-verified per-area offline packs to reduce the initial install size.

## Local schema

- `sessions`: area, timestamps, energy, mood, skin, conditions, reflection, and general notes.
- `attempts`: result (`attempt`, `send`, or `flash`), number of represented tries, perceived difficulty from -2 to +2, timestamp, and notes.
- `problem_notes`: durable beta and reminders that are not tied to a single attempt.
- `metadata`: topo version, update state, the system/light/dark theme preference, and the system/en/ja language preference.

## Export and import

JSON (`opentopo-log`) is the lossless backup format for sessions, attempts, and problem notes. CSV is a flattened attempt table for spreadsheets and personal analysis. Both are generated locally and handed to the operating-system share sheet only after a user action.

Import is also user-initiated: the system file picker can load a JSON backup or a compatible attempts spreadsheet. Each import asks whether to **merge** (keep existing rows; JSON overwrites matching ids) or **replace** (clear private log tables first). Spreadsheet import resolves area/boulder/problem names against the offline topo, rebuilds minimal day+area sessions, and reports skipped rows when names do not match.
