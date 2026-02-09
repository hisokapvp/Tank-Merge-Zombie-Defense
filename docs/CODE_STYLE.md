# Code Style

This project favors clarity and low overhead over heavy tooling.

## JavaScript

- Use `const` and `let` (avoid `var` unless matching existing style).
- Prefer small, single-purpose functions.
- Avoid allocating objects in tight loops; use pooling for high-churn data.
- Keep UI text in i18n files and use `Game.I18n.t()`.
- Keep functions side-effect aware; name clearly when mutating state.

## HTML

- Use semantic elements and keep structure readable.
- Add `data-i18n` for user-facing strings.
- Add ARIA labels and dialog roles for modals.

## CSS

- Keep class names consistent with existing BEM-like style.
- Avoid global selectors and heavy overrides.

## Tests

- Tests are plain Node scripts under Test/.
- Prefer deterministic inputs and explicit assertions.

## Misc

- No trailing whitespace.
- Avoid adding heavy dependencies.
