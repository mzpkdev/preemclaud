# Dark Mode Support Tasks
> From: **prompt** | Codename: **velvet-lantern**

**Goal:** Add full dark mode support to an existing React + Tailwind CSS application, with system preference detection, a persistent manual toggle, and theme coverage for all existing components.

## Task Overview

| # | Task | Depends on | Parallel |
|---|------|-----------|----------|
| 1 | Theme infrastructure & context provider | — | Yes |
| 2 | System preference detection | — | Yes |
| 3 | Persistent toggle & localStorage sync | 1 | No |
| 4 | Tailwind dark mode configuration & design tokens | — | Yes |
| 5 | Component theme migration | 1, 4 | No |
| 6 | Toggle UI component | 1, 3 | No |
| 7 | Integration testing & QA | 1–6 | No |

---

## Task 1: Theme Infrastructure & Context Provider

**Objective:** Create a React context that holds the current theme state ("light", "dark", or "system") and exposes it app-wide through a provider and hook.

### Context

Dark mode in a React + Tailwind app works by toggling a `dark` class on the root `<html>` element. Tailwind's `darkMode: 'class'` strategy then applies `dark:` variants throughout the component tree. The React side needs a central piece of state that tracks the user's intent (light, dark, or follow system) and translates that into the correct class on `<html>`.

This task creates that central piece: a `ThemeContext` and `ThemeProvider` that wrap the app. All other tasks depend on or interact with this provider — it is the foundation of the feature. The provider should not yet worry about persistence (Task 3) or system detection (Task 2); it only needs to accept an initial theme value, expose `theme` (the resolved light/dark value) and `themePreference` (the raw user preference including "system"), and provide a `setThemePreference` function.

Design decision: the context stores the user's **preference** ("light" | "dark" | "system"), not the resolved theme. Resolution (converting "system" into "light" or "dark") happens inside the provider so consumers always get a resolved value from a `useTheme()` hook. This separation keeps the toggle logic clean and makes persistence straightforward.

### Requirements

- Create a `ThemeProvider` component that wraps the application and manages theme state
- Store theme preference as one of three values: `"light"`, `"dark"`, `"system"`
- Expose a `useTheme()` hook returning `{ theme, themePreference, setThemePreference }`
  - `theme`: resolved value, always `"light"` or `"dark"`
  - `themePreference`: raw preference, `"light"` | `"dark"` | `"system"`
  - `setThemePreference`: function accepting `"light"` | `"dark"` | `"system"`
- When `theme` resolves to `"dark"`, add the class `dark` to the `<html>` element; remove it when `"light"`
- Default preference should be `"system"` when no persisted value exists
- TypeScript types for the context value and preference enum

### Acceptance Criteria

- [ ] `ThemeProvider` renders children and provides context without errors
- [ ] `useTheme()` returns the correct shape (`theme`, `themePreference`, `setThemePreference`)
- [ ] Calling `setThemePreference("dark")` causes `document.documentElement.classList` to contain `"dark"`
- [ ] Calling `setThemePreference("light")` causes `"dark"` to be removed from classList
- [ ] Calling `setThemePreference("system")` defers resolution (can stub to "light" until Task 2 integrates)
- [ ] Hook throws a clear error if used outside the provider
- [ ] Unit tests cover all preference transitions

### Dependencies

- **Blocked by:** None
- **Blocks:** 3, 5, 6

### References

- Tailwind dark mode class strategy: https://tailwindcss.com/docs/dark-mode
- React context API: `createContext`, `useContext`
- Typical file location: `src/contexts/ThemeContext.tsx` or `src/providers/ThemeProvider.tsx`

---

## Task 2: System Preference Detection

**Objective:** Detect the operating system's light/dark preference using the `prefers-color-scheme` media query and expose it as a reactive value that updates in real time.

### Context

Modern operating systems let users set a system-wide light or dark preference. Browsers expose this through the CSS media query `prefers-color-scheme`. The JavaScript API `window.matchMedia('(prefers-color-scheme: dark)')` returns a `MediaQueryList` object whose `.matches` property is `true` when the OS is in dark mode, and which fires a `change` event when the user switches.

This task creates a custom hook — `useSystemTheme()` — that returns the current system preference as `"light"` or `"dark"` and updates reactively when the OS setting changes. This hook will later be consumed by the `ThemeProvider` (Task 1) to resolve the `"system"` preference into an actual theme. Building it as a standalone hook keeps it testable and reusable.

Important edge case: in SSR or test environments, `window.matchMedia` may not exist. The hook should gracefully fall back to `"light"` when the API is unavailable.

### Requirements

- Create a `useSystemTheme()` hook that returns `"light"` or `"dark"` based on `prefers-color-scheme`
- Subscribe to the `change` event on the `MediaQueryList` so the value updates live
- Clean up the event listener on unmount
- Gracefully handle environments where `window.matchMedia` is not available (return `"light"`)
- Export the hook from a shared hooks directory

### Acceptance Criteria

- [ ] `useSystemTheme()` returns `"dark"` when `prefers-color-scheme: dark` matches
- [ ] `useSystemTheme()` returns `"light"` when `prefers-color-scheme: dark` does not match
- [ ] Changing the OS preference (or simulating via test) triggers a re-render with the new value
- [ ] No memory leaks — event listener is removed on unmount
- [ ] Returns `"light"` without throwing when `window.matchMedia` is undefined (SSR/test safety)
- [ ] Unit tests mock `matchMedia` to verify both states and the transition

### Dependencies

- **Blocked by:** None
- **Blocks:** None directly (but Task 1 will consume this hook during integration)

### References

- MDN `matchMedia`: https://developer.mozilla.org/en-US/docs/Web/API/Window/matchMedia
- MDN `prefers-color-scheme`: https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme
- Typical file location: `src/hooks/useSystemTheme.ts`

---

## Task 3: Persistent Toggle & localStorage Sync

**Objective:** Persist the user's theme preference to `localStorage` so it survives page reloads and new tabs, and hydrate the `ThemeProvider` from stored values on mount.

### Context

Without persistence, the user's manual toggle resets on every page load — a poor experience. This task connects `localStorage` to the `ThemeProvider` (from Task 1) so the preference is saved whenever it changes and restored on mount.

The localStorage key should be a well-namespaced string (e.g., `"theme-preference"`) storing one of `"light"`, `"dark"`, or `"system"`. On mount, the provider reads this key; if it exists and is valid, it uses it as the initial preference. If it doesn't exist or is corrupted, the provider defaults to `"system"`.

Design decision: persistence is a side effect of `setThemePreference`, not a separate sync mechanism. When the user changes their preference, the provider (a) updates React state, (b) writes to localStorage, and (c) updates the `<html>` class — all in one flow. This avoids drift between state and storage.

Cross-tab sync is a nice-to-have: listening to the `storage` event lets other open tabs react when the user changes the theme in one tab. This should be included if straightforward, but should not complicate the core flow.

Flash-of-unstyled-content (FOUC) prevention: because React hydrates after the initial paint, there can be a flash of the wrong theme. A small inline `<script>` in `index.html` (or the document head) that reads localStorage and sets the `dark` class before React mounts eliminates this. This script runs synchronously before first paint.

### Requirements

- On mount, read `localStorage.getItem("theme-preference")` and use it as the initial preference if valid
- On preference change, write the new value to `localStorage.setItem("theme-preference", value)`
- Handle corrupted or unexpected localStorage values by falling back to `"system"`
- Add a blocking inline script to the HTML document head that reads the stored preference and applies the `dark` class before first paint (FOUC prevention)
- (Nice-to-have) Listen to the `storage` event for cross-tab synchronization

### Acceptance Criteria

- [ ] Changing the theme preference writes to `localStorage` under the key `"theme-preference"`
- [ ] Reloading the page restores the previously selected preference
- [ ] If localStorage contains an invalid value, the app defaults to `"system"` without errors
- [ ] If localStorage is empty (first visit), the app defaults to `"system"`
- [ ] The FOUC prevention script applies the correct class before React hydrates — no visible flash when reloading in dark mode
- [ ] Unit tests cover: save on change, restore on mount, invalid value handling, empty storage

### Dependencies

- **Blocked by:** 1 (ThemeProvider must exist to integrate with)
- **Blocks:** 6

### References

- `localStorage` API: `getItem`, `setItem`, `removeItem`
- `window.addEventListener("storage", ...)` for cross-tab sync
- FOUC prevention pattern: inline `<script>` in `<head>` before any stylesheets/React mount
- Typical location for the inline script: `public/index.html` or equivalent entry HTML

---

## Task 4: Tailwind Dark Mode Configuration & Design Tokens

**Objective:** Configure Tailwind for class-based dark mode and define a consistent set of design tokens (CSS custom properties or Tailwind theme extensions) for light and dark themes.

### Context

Tailwind supports dark mode through the `dark:` variant prefix. When `darkMode: 'class'` is set in the Tailwind config, any utility prefixed with `dark:` applies only when a parent element (typically `<html>`) has the class `dark`. This is the strategy the ThemeProvider (Task 1) uses.

This task does two things:

1. **Configure Tailwind** — set `darkMode: 'class'` in `tailwind.config.js` (or `tailwind.config.ts`). This is a one-line change but foundational for every other dark mode utility to work.

2. **Define design tokens** — rather than letting each component independently choose dark colors (which leads to inconsistency), define a semantic color palette that maps to different values in light vs. dark mode. For example, `bg-surface` might map to `white` in light mode and `gray-900` in dark mode. This can be done via:
   - CSS custom properties defined in the global stylesheet (e.g., `--color-surface: #fff` in `:root` and `--color-surface: #111827` in `.dark`), extended into Tailwind's theme, OR
   - Tailwind's `theme.extend.colors` with CSS variable references

The CSS custom property approach is recommended because it works with Tailwind's utility classes, keeps the mapping centralized, and makes future theme changes trivial.

Token categories to define at minimum:
- **Backgrounds:** surface, surface-secondary, surface-elevated
- **Text:** primary, secondary, muted
- **Borders:** default, subtle
- **Interactive:** button-primary, button-primary-hover, focus-ring
- **Status:** (error, warning, success — if used in the app)

### Requirements

- Set `darkMode: 'class'` in the Tailwind configuration file
- Define CSS custom properties for light and dark themes in the global stylesheet
- Extend the Tailwind theme to reference these custom properties so they're usable as utility classes (e.g., `bg-surface`, `text-primary`)
- Cover at minimum: backgrounds (3 levels), text (3 levels), borders (2 levels), interactive states (2 levels)
- Document the token names and their intended use in a comment block or a simple reference section at the top of the stylesheet

### Acceptance Criteria

- [ ] `tailwind.config` has `darkMode: 'class'` set
- [ ] Global stylesheet defines CSS custom properties under `:root` (light) and `.dark` (dark)
- [ ] Tailwind theme extension maps semantic color names to the CSS variables
- [ ] Using `bg-surface` in a component applies the correct background for both light and dark modes
- [ ] The token palette is documented (inline comments or a brief reference at the top of the CSS file)
- [ ] A quick visual check: a `<div className="bg-surface text-primary">` renders correctly in both themes

### Dependencies

- **Blocked by:** None
- **Blocks:** 5

### References

- Tailwind `darkMode` config: https://tailwindcss.com/docs/dark-mode
- Tailwind theme customization: https://tailwindcss.com/docs/theme
- CSS custom properties for theming: standard pattern — define vars in `:root` / `.dark`, consume in Tailwind `theme.extend`
- Typical files: `tailwind.config.js` / `tailwind.config.ts`, `src/styles/globals.css` (or equivalent)

---

## Task 5: Component Theme Migration

**Objective:** Update all existing components to use the semantic design tokens (from Task 4) and add `dark:` variant overrides where tokens don't cover the need, so every component renders correctly in both light and dark mode.

### Context

With the design tokens in place (Task 4) and the ThemeProvider managing the `dark` class (Task 1), the remaining work is mechanical but important: every existing component needs to be reviewed and updated so it looks correct in dark mode.

There are two strategies, used together:

1. **Replace hardcoded colors with semantic tokens.** A component using `bg-white` should switch to `bg-surface`. A component using `text-gray-900` should switch to `text-primary`. This is the preferred approach because it's centralized — changing a token value updates every component at once.

2. **Add `dark:` variants for cases tokens don't cover.** Some components have decorative or one-off colors (a specific accent, a shadow, a gradient) that don't map to a semantic token. For these, add explicit `dark:` overrides like `shadow-lg dark:shadow-gray-900/50` or `bg-blue-100 dark:bg-blue-900`.

This task should be done component by component, ideally grouped by feature area or page. Each component should be visually verified in both modes after migration.

Common gotchas:
- **Images and illustrations** — light-themed images can look jarring on a dark background. Consider adding `dark:invert` or swapping image sources for key graphics.
- **Borders and dividers** — often hardcoded to light gray and invisible in dark mode. These are easy to miss.
- **Box shadows** — light mode shadows look wrong on dark backgrounds. Dark mode typically uses lighter, more diffuse shadows or subtle borders instead.
- **Third-party component libraries** — if the app uses a component library (e.g., Headless UI, Radix), check whether it needs separate dark mode configuration.
- **Form inputs** — browser default styles for inputs often clash with dark backgrounds.

### Requirements

- Audit every existing component for hardcoded color utilities
- Replace hardcoded colors with semantic token utilities where applicable (`bg-white` -> `bg-surface`, `text-gray-900` -> `text-primary`, etc.)
- Add `dark:` variant overrides for any colors that don't map to a semantic token
- Address images/illustrations that look wrong in dark mode (add `dark:invert`, conditional sources, or opacity adjustments)
- Address form inputs, borders, shadows, and any third-party component styling
- Group changes by feature area for manageable, reviewable PRs

### Acceptance Criteria

- [ ] No remaining hardcoded color utilities (`bg-white`, `text-black`, `border-gray-200`, etc.) where a semantic token exists
- [ ] Every component renders correctly and is legible in both light and dark mode
- [ ] Borders and dividers are visible in dark mode
- [ ] Shadows are appropriate for each theme (not invisible or glaring)
- [ ] Form elements (inputs, selects, textareas) are styled for both themes
- [ ] Images and illustrations don't look broken against a dark background
- [ ] Visual spot-check of every page/route in both themes passes

### Dependencies

- **Blocked by:** 1 (ThemeProvider), 4 (design tokens)
- **Blocks:** 7

### References

- Design token names and mappings from Task 4's global stylesheet
- Component inventory: audit `src/components/` (and any `src/pages/` or `src/features/` directories)
- Tailwind `dark:` variant: https://tailwindcss.com/docs/dark-mode#toggling-dark-mode-manually

---

## Task 6: Toggle UI Component

**Objective:** Build a user-facing theme toggle control that lets users switch between light, dark, and system modes, with clear visual feedback for the active state.

### Context

This is the user-visible piece of the feature. The toggle component calls `setThemePreference` from the `useTheme()` hook (Task 1) and displays the current preference. It should support three states — light, dark, and system — not just a binary switch, because the "system" option is a distinct user intent ("follow my OS").

Common UI patterns for a three-way theme toggle:
- **Segmented control / button group** — three buttons (sun icon, moon icon, monitor/system icon), one highlighted as active. Clean and explicit.
- **Dropdown / select** — a single button showing the current mode, opens to show all three options. Compact, good for tight navigation bars.
- **Cycle button** — a single button that cycles through modes on each click, showing the current mode's icon. Minimal space, but less discoverable.

The segmented control is recommended for clarity unless space is very constrained.

The toggle should be placed in the app's main navigation or header — wherever user settings typically live. If there's a settings page, it could appear there too.

### Requirements

- Create a `ThemeToggle` component that consumes `useTheme()`
- Support all three preferences: light, dark, system
- Show an icon for each mode: sun (light), moon (dark), monitor or auto-icon (system)
- Visually indicate the currently active preference
- Ensure the toggle itself is styled correctly in both light and dark mode
- The component must be accessible: keyboard navigable, appropriate ARIA labels, sufficient contrast
- Place the component in the app's header/navigation (or export it ready for placement)

### Acceptance Criteria

- [ ] Clicking "light" calls `setThemePreference("light")` and the app switches to light mode
- [ ] Clicking "dark" calls `setThemePreference("dark")` and the app switches to dark mode
- [ ] Clicking "system" calls `setThemePreference("system")` and the app follows OS preference
- [ ] The active state is visually distinct
- [ ] The toggle looks correct in both light and dark mode
- [ ] Keyboard navigation works (Tab to focus, Enter/Space to activate)
- [ ] Screen readers announce the purpose and current state (e.g., `aria-label="Theme preference"`, `aria-pressed` or equivalent)
- [ ] Unit tests verify that clicking each option calls the correct setter

### Dependencies

- **Blocked by:** 1 (ThemeProvider), 3 (persistence — so the toggle's choice survives reload)
- **Blocks:** 7

### References

- `useTheme()` hook API from Task 1
- Icon libraries: Heroicons (`SunIcon`, `MoonIcon`, `ComputerDesktopIcon`), Lucide, or similar
- Accessibility: WAI-ARIA button patterns, `role="radiogroup"` for segmented controls
- Typical file location: `src/components/ThemeToggle.tsx`

---

## Task 7: Integration Testing & QA

**Objective:** Verify the complete dark mode feature works end-to-end — system detection, manual toggle, persistence, cross-tab sync, FOUC prevention, and correct rendering of all components in both themes.

### Context

Tasks 1–6 build individual pieces of the dark mode feature. This task verifies they work together correctly and catches integration issues that unit tests on individual pieces wouldn't find.

Key integration scenarios to test:

1. **First visit flow:** User opens the app for the first time. No localStorage value exists. The app should detect the OS preference and apply the correct theme immediately (no flash).

2. **Manual override flow:** User manually selects "dark" via the toggle. The theme changes. User reloads — the theme is still "dark". User changes OS to light — the theme stays "dark" because manual override takes precedence.

3. **System follow flow:** User selects "system" in the toggle. The theme follows OS. User changes OS from light to dark — the app updates in real time without a reload.

4. **Cross-tab sync:** User has two tabs open. Changing the theme in one tab updates the other (if implemented).

5. **FOUC prevention:** In dark mode, a hard reload does not show a white flash before the dark theme applies.

6. **Component rendering:** Every page and component looks correct in both themes. No invisible text, missing borders, broken images, or clashing colors.

Testing approach:
- **E2E tests** (Cypress or Playwright) for flows 1–5 — these involve browser APIs (localStorage, matchMedia, multiple tabs) that are best tested in a real browser environment
- **Visual regression tests** (optional but recommended) — screenshot comparisons of key pages in both themes to catch subtle rendering issues
- **Manual QA checklist** — for component rendering spot-checks that automated tests might miss

### Requirements

- Write E2E tests covering: first visit, manual override, system follow, persistence across reload
- Write E2E tests for FOUC prevention (assert no white flash on reload in dark mode)
- Create a QA checklist of every page/route to verify visually in both themes
- If cross-tab sync was implemented (Task 3), test that changing the theme in one tab updates another
- Test edge cases: localStorage manually cleared, localStorage set to invalid value, matchMedia not available (e.g., old browser)

### Acceptance Criteria

- [ ] E2E test: first visit with system dark preference renders dark theme
- [ ] E2E test: first visit with system light preference renders light theme
- [ ] E2E test: selecting "dark" in toggle, reloading, and confirming dark mode persists
- [ ] E2E test: selecting "system" after manual override, and confirming OS preference takes over
- [ ] E2E test: no FOUC on reload (dark mode page does not flash white)
- [ ] E2E test: corrupted localStorage value results in graceful fallback to system
- [ ] QA checklist completed for all pages in both themes
- [ ] All existing test suites still pass (no regressions from component changes in Task 5)

### Dependencies

- **Blocked by:** 1, 2, 3, 4, 5, 6 (all tasks must be complete)
- **Blocks:** None

### References

- E2E framework: Cypress (`cy.visit`, `cy.window`, `cy.stub` for matchMedia) or Playwright (`page.emulateMedia`, `page.evaluate`)
- FOUC test pattern: navigate to page, immediately screenshot or assert background color before any JS executes
- Visual regression: Percy, Chromatic, or Playwright screenshot comparison
- QA checklist: derive from the component inventory used in Task 5
