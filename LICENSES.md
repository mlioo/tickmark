# OpenTopo Companion Licensing

OpenTopo Companion uses the same split license as [OpenTopo Japan](https://github.com/mlioo/opentopo) so that software code and climbing resources can be handled clearly.

## Code: GNU AGPLv3

All software code in this repository is licensed under the GNU Affero General Public License version 3.0, unless a file says otherwise.

This includes:

- `src/` (except bundled topo seed data; see below)
- `scripts/`
- `App.tsx`, `index.ts`, `app.config.ts`
- `android/` and `ios/` application code authored for this project
- build, validation, and application code
- generated application code such as `src/data/topoAssets.ts`

See [LICENSE](LICENSE) for the full AGPLv3 text.

Important note: AGPLv3 is a strong copyleft software license, but it is not a non-commercial software license. It requires recipients and network users to receive the same software freedoms and corresponding source code obligations. It does not, by itself, ban commercial use of the code.

## Content and Resources: CC BY-NC-SA 4.0

All non-code content and resources in this repository are licensed under Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International, unless a file says otherwise.

This includes:

- `assets/`
- bundled topo seed data in `src/data/topo.seed.json`
- area data, boulder data, problem data, topo line data, access notes, and parking notes
- photos, map images, illustrations, app icons, and other media resources

Bundled topo data and photos are copied from OpenTopo Japan (`pnpm sync:topo`) and remain under CC BY-NC-SA 4.0.

See [LICENSE-CC-BY-NC-SA-4.0](LICENSE-CC-BY-NC-SA-4.0) for the full CC BY-NC-SA 4.0 legal code.

The CC BY-NC-SA 4.0 license is intended to prevent commercial reuse of OpenTopo Japan's content and resources without separate permission.

## Commercial Permission

Commercial use of the CC BY-NC-SA 4.0 licensed content and resources requires separate written permission from the project maintainers or applicable rights holders.

## Third-Party Material

Do not add third-party guidebook scans, copyrighted topo images, copied text, or other restricted material unless you have permission and document the permission in the contribution.

Some dependencies or third-party libraries may be available under their own licenses. Those licenses apply to the third-party material only.
