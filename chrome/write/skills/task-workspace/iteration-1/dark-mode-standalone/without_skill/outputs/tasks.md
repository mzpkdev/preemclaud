# Dark Mode Implementation — Task Breakdown

## Overview
Add dark mode support to an existing React + Tailwind CSS application with system preference detection, a manual toggle persisted in localStorage, and full theme support across all existing components.

---

## Task 1: Configure Tailwind CSS for Dark Mode

**Goal:** Enable Tailwind's `class`-based dark mode strategy so that dark styles are applied when a `dark` class is present on the `<html>` element.

**Steps:**
- In `tailwind.config.js`, set `darkMode: 'class'`.
- Verify the Tailwind build picks up the new configuration.

**Acceptance Criteria:**
- Adding `class="dark"` to `<html>` causes Tailwind's `dark:` variant utilities to take effect.

---

## Task 2: Define a Dark Mode Color Palette and Design Tokens

**Goal:** Establish the set of colors and design tokens for both light and dark themes so that component work has a clear reference.

**Steps:**
- Audit the current color usage across components (backgrounds, text, borders, shadows, accent colors).
- Define dark-mode equivalents for every color token in use.
- Optionally, add CSS custom properties in `index.css` (e.g., `--color-bg-primary`) mapped to light/dark values, or decide to use Tailwind `dark:` utilities directly.
- Document the palette in a brief reference (or as comments in the Tailwind config `extend.colors`).

**Acceptance Criteria:**
- A clear mapping exists from every light-theme color to its dark-theme counterpart.
- The team can reference this mapping when updating components.

---

## Task 3: Implement the Theme Context and Provider

**Goal:** Create a React context that manages the current theme state, reads system preferences, supports manual override, and persists the user's choice in localStorage.

**Steps:**
- Create `src/context/ThemeContext.tsx` (or similar) exporting `ThemeProvider` and a `useTheme` hook.
- On mount, read `localStorage.getItem('theme')`:
  - If `'dark'` or `'light'`, use that value (manual override).
  - If absent or `'system'`, fall back to `window.matchMedia('(prefers-color-scheme: dark)')`.
- Listen for changes to the system preference via `matchMedia.addEventListener('change', ...)` so the theme updates live when the user is in "system" mode.
- Expose three actions from the hook: `setLight()`, `setDark()`, `setSystem()` (or a single `setTheme('light' | 'dark' | 'system')`).
- When the resolved theme changes, add or remove the `dark` class on `document.documentElement`.
- Persist the user's explicit choice (`'light'`, `'dark'`, or `'system'`) to `localStorage` on every change.

**Acceptance Criteria:**
- `useTheme()` returns `{ theme, resolvedTheme, setTheme }` where `theme` is the stored preference and `resolvedTheme` is `'light'` or `'dark'`.
- Changing the OS preference while in "system" mode updates the app in real time.
- Refreshing the page restores the previously chosen mode.
- The `dark` class is correctly toggled on `<html>`.

---

## Task 4: Prevent Flash of Incorrect Theme on Page Load

**Goal:** Ensure the correct theme is applied before the first paint to avoid a flash of light mode when the user prefers dark (or vice versa).

**Steps:**
- Add a small inline `<script>` in `index.html` (before the React bundle) that reads localStorage and the system preference, then sets the `dark` class on `<html>` synchronously.
- Keep this script minimal — no dependencies, no module imports.

**Acceptance Criteria:**
- Hard-refreshing the page with dark mode selected shows no white flash.
- Works correctly for all three states: explicit light, explicit dark, system preference.

---

## Task 5: Build the Theme Toggle Component

**Goal:** Create a UI control that lets users switch between light, dark, and system modes.

**Steps:**
- Create `src/components/ThemeToggle.tsx`.
- Use the `useTheme` hook to read and set the theme.
- Provide three options (e.g., a segmented control, dropdown, or cycle button with sun/moon/monitor icons).
- Show a visual indicator of which mode is active.
- Ensure the toggle itself is styled for both light and dark themes.

**Acceptance Criteria:**
- Clicking the toggle cycles through or selects light / dark / system.
- The choice persists across page reloads.
- The toggle is keyboard-accessible and has appropriate aria labels.

---

## Task 6: Update Global and Layout Styles

**Goal:** Apply dark-mode styles to the app shell — background, default text color, scrollbar, selection color, and any global styles.

**Steps:**
- In the root layout or `App.tsx`, apply Tailwind classes like `bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100` (adjusted to your palette).
- Update `index.css` or global stylesheet for any non-Tailwind global styles (e.g., `::selection`, `scrollbar-color`, `body` defaults).
- Ensure `<html>` and `<body>` have appropriate background colors so there is no white bleed.

**Acceptance Criteria:**
- The entire viewport has the correct background in both themes.
- Default text is readable against the background in both themes.

---

## Task 7: Update All Existing Components for Dark Mode

**Goal:** Audit every component and add `dark:` variant classes where needed.

**Steps:**
- Generate a list of all component files.
- For each component, review hardcoded colors (backgrounds, text, borders, rings, shadows, dividers, placeholder text).
- Add corresponding `dark:` utility classes based on the color mapping from Task 2.
- Pay special attention to:
  - Buttons (all variants: primary, secondary, ghost, destructive).
  - Form inputs, selects, textareas, checkboxes, radio buttons.
  - Cards, modals, dialogs, popovers, tooltips, dropdowns.
  - Navigation bars, sidebars, footers.
  - Tables and list items.
  - Alerts, toasts, badges, tags.
  - Loading spinners and skeleton screens.
- For images or illustrations with baked-in light backgrounds, consider using `dark:invert`, `dark:brightness-*`, or swapping to dark-friendly variants.
- For shadows, consider using `dark:shadow-none` or switching to lighter/colored shadows that are visible on dark backgrounds.

**Acceptance Criteria:**
- Every component renders correctly in both light and dark mode.
- No white "holes" or unreadable text in dark mode.
- No dark "holes" or invisible elements in light mode.

---

## Task 8: Update Third-Party and Embedded Content

**Goal:** Ensure any third-party UI (component libraries, embedded iframes, syntax highlighters, markdown renderers, charts, maps) respects the theme.

**Steps:**
- Identify all third-party UI components in use.
- For component libraries with theme support, pass the current theme or configure their dark mode integration.
- For syntax highlighters (e.g., Prism, Shiki), swap the theme.
- For charts (e.g., Recharts, Chart.js), update color schemes.
- For embedded content that cannot be themed, wrap in a container with appropriate background.

**Acceptance Criteria:**
- Third-party components visually match the active theme.
- No jarring contrast between app UI and third-party elements.

---

## Task 9: Add Transition Animations

**Goal:** Smooth the visual transition when switching themes so it does not feel jarring.

**Steps:**
- Add a CSS transition on `background-color` and `color` to the `<html>` or `<body>` element (e.g., `transition-colors duration-200`).
- Consider whether other properties (borders, shadows) should also transition.
- Ensure the transition does NOT apply on initial page load (only on toggle), to avoid a slow fade-in on first paint.

**Acceptance Criteria:**
- Toggling the theme produces a smooth color transition.
- The initial page load applies the theme instantly with no transition.

---

## Task 10: Write Tests

**Goal:** Verify the theme logic and toggle behavior with automated tests.

**Steps:**
- Unit-test `ThemeProvider` / `useTheme`:
  - Defaults to system preference when localStorage is empty.
  - Reads and applies a stored preference from localStorage.
  - Updates localStorage when the user changes the theme.
  - Responds to `matchMedia` change events in system mode.
  - Adds/removes the `dark` class on `document.documentElement`.
- Component-test `ThemeToggle`:
  - Renders correctly.
  - Clicking cycles through modes.
  - Displays the correct active state.
- Integration / E2E test:
  - Toggle dark mode, reload, verify persistence.
  - Emulate `prefers-color-scheme: dark` and verify system detection.

**Acceptance Criteria:**
- All theme-related logic has unit test coverage.
- The toggle component has interaction tests.
- At least one E2E test covers the full flow (toggle, persist, reload).

---

## Task 11: Manual QA and Visual Review

**Goal:** Catch any visual issues that automated tests miss.

**Steps:**
- Walk through every page/route in both light and dark mode.
- Check responsive breakpoints (mobile, tablet, desktop) in both modes.
- Test in multiple browsers (Chrome, Firefox, Safari).
- Verify keyboard navigation and screen reader announcements for the toggle.
- Verify no accessibility contrast violations using a tool like axe or Lighthouse.
- Test the OS-level preference toggle while the app is open in "system" mode.

**Acceptance Criteria:**
- No visual regressions in light mode.
- Dark mode is visually polished across all pages, breakpoints, and browsers.
- Accessibility audit passes with no new contrast issues.

---

## Suggested Execution Order

| Phase | Tasks | Notes |
|-------|-------|-------|
| 1 — Foundation | 1, 2 | Config and design decisions; no UI changes yet |
| 2 — Core Logic | 3, 4 | Theme context and flash prevention |
| 3 — Toggle UI | 5 | User-facing control |
| 4 — Styling | 6, 7, 8, 9 | Bulk of the work; parallelizable across team members |
| 5 — Verification | 10, 11 | Tests and manual QA |

Tasks within each phase can generally be worked in parallel. Tasks across phases have dependencies (e.g., component updates in Phase 4 depend on the color palette from Phase 1 and the context from Phase 2).
