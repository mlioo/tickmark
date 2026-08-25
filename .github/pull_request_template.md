## Summary

<!-- What does this PR change, and why? -->

## Checklist

- [ ] I read [CONTRIBUTING.md](./CONTRIBUTING.md)
- [ ] `pnpm typecheck`, `pnpm lint`, and `pnpm test` pass locally
- [ ] Native Android/iOS compile considered if `android/` or `ios/` (or shared native config) changed
- [ ] Privacy boundary preserved: no accounts/analytics/ads; runtime `fetch` stays on the GitHub allowlist in `src/network/`
- [ ] Private climbing data stays on-device (SQLite); no background sync of logs
- [ ] User-facing copy updated in both `src/i18n/en.ts` and `src/i18n/ja.ts` when UI text changed
- [ ] Topo seed / assets regenerated with `pnpm sync:topo` when content under the web project changed
- [ ] No secrets committed (`.env`, API keys, signing files)

## Test plan

<!-- How did you verify this? Simulator, emulator, unit tests, screenshots, etc. -->

-
