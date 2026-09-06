# Stocks UI revert

The previous look is frozen as:

- `index.legacy.html`
- `styles.legacy.css`

## Easy way (in app)

Stocks settings → **Appearance → UI layout → classic**

That loads the legacy HTML + CSS exactly.

Set it back to **organized** for the new layout.

## Manual way

Copy:

- `styles.legacy.css` → `styles.css`
- `index.legacy.html` → `index.html`

Then remove the classic redirect script from `index.html` if you want that file to stay permanent.
