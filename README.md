# OpenTopo Companion

Offline-first iOS and Android climbing log built with Expo and React Native.

## Product shape

- **Log:** start an area session, record how many tries each attempt/send represents, add per-entry notes and perceived difficulty, then finish with energy, mood, skin, conditions, and reflection.
- **Topo:** use a live, pan-and-zoom map (Apple Maps / MapKit on iOS, OpenStreetMap via MapLibre on Android) to find verified area and boulder coordinates, browse local topo photos, and view problem lines over correctly scaled source imagery. The bundle is generated from the sibling `../OpenTopo/content/areas` project.
- **Progress:** sends by grade and area, average tries per send overall and by grade, send rate, session frequency, hardest grade, and month-by-month progression.
- **Data:** export the full private log as JSON or attempts as CSV. Check for topo updates explicitly from the OpenTopo GitHub repository.

## Privacy and networking

The app has no accounts, analytics, ads, or background sync. Climbing activity and the system/light/dark theme choice are stored only in `opentopo-companion.db`. Runtime `fetch` calls live in `src/network/opentopo.ts` and reject every host except GitHub's API and raw-content hosts. The Find Climbing map uses Apple Maps (MapKit) on iOS and MapLibre Native with OpenStreetMap tiles on Android; the app does not request third-party map-tile hosts from JavaScript. GPS uses the operating system's foreground location service and starts only after tapping **My location**.

File sharing uses the operating-system share sheet and only runs after an export button is tapped.

## Development

```sh
source ./scripts/ensure-node-tools.sh
pnpm install
pnpm sync:topo
pnpm typecheck
pnpm lint
pnpm test
pnpm start
```

Use `pnpm ios:sim` or `pnpm android:emu` with the corresponding simulator/emulator available.

Pull requests to `main` must pass the Typecheck, Lint, and Test GitHub Actions checks. Native Android and iOS compile jobs run when those directories (or shared native config) change. See [CONTRIBUTING.md](./CONTRIBUTING.md).

## Refreshing bundled topo data

Run `pnpm sync:topo` after changing files under `../OpenTopo/content/areas`. This regenerates `src/data/topo.seed.json`, copies referenced photos into `assets/topo`, and generates the static React Native asset registry. App startup imports a changed bundle into SQLite but will not overwrite a newer GitHub-downloaded topo.

If the web project is not in the default sibling location, provide its absolute path:

```sh
OPENTOPO_WEB_ROOT=/path/to/OpenTopo pnpm sync:topo
```

## License

OpenTopo Companion uses the same split license as OpenTopo Japan:

- **Code:** GNU Affero General Public License v3.0. See [LICENSE](LICENSE).
- **Content and resources:** Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International. See [LICENSE-CC-BY-NC-SA-4.0](LICENSE-CC-BY-NC-SA-4.0).

See [LICENSES.md](LICENSES.md) for the full licensing policy and which files each license applies to. The non-code content/resource license is non-commercial; commercial reuse of area data, topo data, photos, maps, and other resources requires separate permission.

## Next release work

1. Resize source photos for mobile and add downloadable per-area packs with checksums.
2. Add grade-system preferences and Japanese/English UI settings.
3. Add database migration tests and device-level accessibility checks.
