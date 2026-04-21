# SELECTORS.md

If the game updates and the extension stops working, inspect the DOM and update these classes/selectors in the relevant files:

### `dom-reader.ts`
- Rule elements: `querySelectorAll("[class*='rule']")`
- Satisfied state checks: `.classList.contains("satisfied")`, `.completed`, `.rule-satisfied`, `svg.checkmark`, etc.

### `dom-writer.ts`
- Editor: `querySelector("[contenteditable='true']")`
- ProseMirror View properties: `.pmViewDesc.view`, `.__view`, `._view`

### `dom-observer.ts`
- Rule Container: `querySelector("[class*='rules'], [class*='rule-list']")`
