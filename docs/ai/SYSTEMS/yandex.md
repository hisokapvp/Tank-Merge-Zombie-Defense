# Yandex SDK / Build Sanitiser Allowlist

`solo-pipeline-yandex-vk` batch#3 (item 11). Documents the contract between
`src/yandex/yandexSdk.js` and the build-time URL/host sanitiser in
`ci/build_release.mjs`. Read this before touching either file or before adding
any link, dev URL, or local path that ends up in shipped sources.

## Two-layer defense

The release build aims to ship zero dev-host literals, zero loopback addresses,
zero local file paths, and zero source-map references. Defense is layered:

1. **Source-level discipline (primary).** JSDoc and inline comments in the
   real game source must avoid concrete dev/CDN host literals. Use neutral
   phrases such as `[redacted Yandex iframe host]`, `the Yandex Games iframe
   host`, or `the Yandex Games portal host`. See
   `src/yandex/yandexSdk.js` for the canonical example after batch#3 item 10.
2. **Build sanitiser (defense-in-depth).** `ci/build_release.mjs` runs three
   passes over every file in the release zip: full-string-literal split,
   comment scrubbing (`.js` / `.css` / `.html`), and free-text scrubbing
   (`.json` / `.md`). After all passes a final assertion via
   `assertNoDevUrlLiterals` aborts the build if any tracked token still
   appears anywhere in the output tree.

Adding a fresh comment with `app-*.games.s3.yandex.net` and "trusting the
sanitiser" is no longer the supported path. Do the source-level edit first;
treat a sanitiser hit on review as a regression, not a feature.

## Tokens the sanitiser removes (rejected)

The canonical list lives in two places in `ci/build_release.mjs`:

* `COMMENT_REJECT_RE` — matched against `.js` / `.css` / `.html` comments and
  free-text in `.json` / `.md`. Each match is rewritten in place to
  `[redacted]`.
* `YANDEX_REJECT_PATTERNS` — final assertion guard. Any match here is a hard
  build error.

Both regex sets must stay in sync with this list. If you add or change a
pattern, update this section and link the diff in the PR description.

| Category | Tokens | Replacement / behaviour |
| --- | --- | --- |
| Local schemes | `file://`, `capacitor://` | `[redacted]` (comments) / build error (sources) |
| Loopback hosts | `localhost`, `127.0.0.1`, `0.0.0.0`, `::1` | `[redacted]` |
| Yandex CDN hosts | `s3.yandex.net`, `app-*.games.s3.yandex.net`, `games.s3.yandex.net` | `[redacted]` |
| Yandex storage | `yandex-storage`, `storage.yandexcloud*`, `.yandexcloud.*` | `[redacted]` |
| Yandex static CDN | `yastatic*` | `[redacted]` |
| Local user paths | `[A-Z]:\Users\` (Windows user paths) | build error |
| Agent infrastructure | `agent-logs`, `.agents\` | build error |
| Internal dashboard | `:87[6-9][0-9]`, `:88[6-9][0-9]` (port range) | build error |
| Source maps | `//# sourceMappingURL=` (any line) | build error |
| Internal placeholder | `tank-merge-zombie-defense.local` | rewritten to `redacted.invalid` |

`COMMENT_REJECT_RE` is forgiving (rewrites silently, build keeps going).
`YANDEX_REJECT_PATTERNS` is strict (any survivor aborts the release). When in
doubt, run `bash ci/build_release.sh` and read the assertion message — it
prints the offending file and the matched substring.

## Tokens that must remain untouched (allowlist)

Some external URL-shaped strings are legitimate and must not be redacted.
The sanitiser explicitly preserves the following:

* **W3C XML namespaces.** Anything matching `http://www.w3.org/...` (e.g.
  `http://www.w3.org/2000/svg`, `http://www.w3.org/1999/xlink`). These are
  XML namespace identifiers, not URLs to fetch. Stripping them breaks SVG
  rendering across every browser.
* **Relative asset paths.** Strings like `assets/...`, `assets/balance/...`,
  `assets/ui/...` are runtime asset references the game loads via
  `AssetLoader`. They have no scheme and no host; the regex set above does
  not target them.
* **Open-source licence URLs.** MIT / Apache / BSD / similar licence URLs in
  `LICENSE`, vendored library headers, or third-party comment blocks. These
  are documentation, not exfiltration risks.
* **Anything under `vendor/`.** The `vendor/**` directory is treated as a
  pre-vendored, externally-licensed corpus and is **not** scrubbed. Add new
  third-party libraries there if they happen to ship their own dev URLs in
  comments — do not paste them into our own `src/`.
* **Explicit allow markers.** Lines containing the marker
  `// yandex-bundle-allow:` are skipped by the comment scrubber. Use this
  sparingly and only for short-lived diagnostics that must survive into a
  build (e.g. an integration test fixture). Production code should never
  rely on this marker.

If a regex change in the sanitiser would catch any of the above by
accident, the change is wrong; tighten the regex (anchor on `.s3.yandex.net`
boundary, exclude `www.w3.org`, etc.) instead of widening the allowlist.

## Quick checklist before merging changes near these files

* Did you add a new dev/CDN host literal in source? Move it out of
  comments; if it is needed at runtime, expose it as a substring fragment as
  done in `_isYandexEnv()`.
* Did you add a new external URL? Confirm whether it is a W3C namespace, a
  licence URL, or a real fetch target. If the latter, it almost certainly
  does not belong in the shipped game.
* Did you change `COMMENT_REJECT_RE` or `YANDEX_REJECT_PATTERNS`? Update
  the table in this file and reference it in the PR.
* Did you `bash ci/build_release.sh` after your edit? The final assertion
  is the source of truth — never bypass it locally.
