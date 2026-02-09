# Release Ops

## Build a release zip

```bash
bash ops/release/build_release.sh
```

Output goes to `dist/release/`.

## Generate changelog only

```bash
node ops/release/generate_changelog.js --out ops/release/CHANGELOG.md
```

## Post-release checks

```bash
bash ops/release/post_release_checks.sh
```

## Notes

- The build is a static zip of runtime files (no bundling).
- If `zip` is not available, PowerShell `Compress-Archive` is used.
