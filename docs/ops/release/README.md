# Релизные операции

## Команды
- Сборка релиза: `bash ops/release/build_release.sh`
- Проверка целостности: `bash ops/release/check_release_integrity.sh`
- Генерация changelog: `node ops/release/generate_changelog.js`
- Пост-проверки: `bash ops/release/post_release_checks.sh`

## Правило
`dist/release/staging/*` не редактировать вручную.
