# Contributing to OpenTopo Companion

Thanks for helping improve the offline climbing companion. This document is the checklist for pull requests into `main`.

## Before you open a PR

1. Fork (or branch from `main`) and keep the change focused.
2. Install tooling with the project sandbox (do not install Node/CocoaPods onto the system unless you have a reason):

   ```sh
   source ./scripts/ensure-node-tools.sh
   pnpm install
   ```

3. Run the same checks CI will run:

   ```sh
   pnpm typecheck
   pnpm lint
   pnpm test
   ```

   Or all three: `pnpm ci`.

4. Fill out the pull request template checklist.

## Required CI checks

Pull requests targeting `main` must pass these GitHub Actions jobs (required status checks):

| Check name | When it runs | Command |
| --- | --- | --- |
| Typecheck | Every PR / push | `pnpm typecheck` |
| Lint | Every PR / push | `pnpm lint` |
| Test | Every PR / push | `pnpm test` |
| Android | `android/` and native-related paths | `./gradlew assembleRelease` |
| iOS | `ios/` and native-related paths | `xcodebuild` Release (simulator) |

Merges are blocked until Typecheck, Lint, and Test are green. The Android and iOS jobs always report a status: they compile when those directories (or shared native config such as `app.config.ts`, `package.json`, and this workflow) change, and skip with a passing result otherwise.

## Project rules reviewers will look for

- **Offline-first / privacy:** No accounts, analytics, ads, or background sync of climbing logs. Private data stays in local SQLite (`opentopo-companion.db`).
- **Network allowlist:** Runtime `fetch` may only target hosts validated in `src/network/allowlist.ts` (GitHub API + raw content today). Do not add unrestricted networking.
- **Topo vs private log:** Public topo tables are replaceable; sessions/attempts/notes must survive topo updates.
- **i18n:** User-visible strings belong in both `src/i18n/en.ts` and `src/i18n/ja.ts`.
- **Topo content:** Prefer regenerating `src/data/topo.seed.json` and assets via `pnpm sync:topo` from the sibling OpenTopo web project rather than hand-editing the seed.
- **Secrets:** Never commit `.env`, API keys, or signing material. Use `.env.example` for documentation only.
- **Native modules:** After adding Expo/RN native deps, run `./scripts/pod-install.sh` (and Android prebuild when plugins change) before claiming device builds work.

## Suggested PR size

Prefer small, reviewable PRs. Separate refactors from behavior changes when you can. Include a short test plan (simulator/emulator notes or unit coverage) in the PR body.

## Development pointers

See [README.md](./README.md) for product overview and [docs/architecture.md](./docs/architecture.md) for offline/network boundaries. Use `pnpm ios:sim` / `pnpm android:emu` for native Release-style smoke checks when UI or native code changes.

## License

By contributing, you agree that your contribution may be distributed under the repository's split license:

- Code contributions are licensed under GNU AGPLv3.
- Non-code content and resource contributions are licensed under CC BY-NC-SA 4.0.

Do not contribute content, photos, copied descriptions, guidebook scans, or topo resources unless you created them yourself or have permission to license them under CC BY-NC-SA 4.0. See [LICENSES.md](LICENSES.md) for details.
