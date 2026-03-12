# Dark Mode Support Tasks
> From: **prompt** | Codename: **velvet-lantern**

**Goal:** Add comprehensive dark mode to the React + Tailwind CSS app with system preference detection, a persistent manual toggle, and full component coverage.

## Task Overview

| # | Task | Depends on | Parallel |
|---|------|-----------|----------|
| 1 | Theme infrastructure & context provider | — | Yes |
| 2 | System preference detection | 1 | No |
| 3 | Manual toggle with localStorage persistence | 1 | No |
| 4 | Tailwind dark mode configuration & design tokens | — | Yes |
| 5 | Component theme migration | 4, 1 | No |
| 6 | Integration testing & edge cases | 2, 3, 5 | No |

---

## Task 1: Theme Infrastructure & Context Provider

### Description

This task lays the foundation that every other dark mode task depends on. We need a React context that holds the current theme state (`"light"` | `"dark"`) and exposes it to the entire component tree, along with a mechanism to apply the theme to the DOM.

The context provider will live at the top of the component tree (wrapping `<App />` or equivalent) and will be responsible for applying or removing the `dark` class on the `<html>` element — this is how Tailwind's `dark:` variant classes activate. Downstream tasks (system detection, manual toggle, component migration) all read from or write to this context.

**Technical decisions:**
- **React Context + `useReducer` over a state management library** — dark mode is a single boolean concern; adding Redux/Zustand overhead is unjustified. Context is the right tool here.
- **`class` strategy (not `media`)** — Tailwind supports two dark mode strategies. We use `class` because we need both system detection *and* a manual override. The `media` strategy only supports system preferences with no user override.
- **Apply `dark` class to `<html>`, not `<body>`** — Tailwind's documentation recommends `<html>` for the `dark` class. This also allows CSS custom properties on `:root` to respond to the class if needed later.
- **Provider exports a `setTheme` function, not just a toggle** — this lets the system-detection task set an explicit value (`"dark"` or `"light"`) rather than blindly toggling, avoiding race conditions between system changes and user intent.

### Acceptance Criteria

**Scenario:** Theme context provides current theme to descendants
- **Given** the `ThemeProvider` wraps the application root
- **When** a child component calls `useTheme()`
- **Then** it receives an object with `theme` (string: `"light"` or `"dark"`) and `setTheme` (function)

**Scenario:** Dark class applied to HTML element
- **Given** the theme state is `"dark"`
- **When** the `ThemeProvider` renders
- **Then** the `<html>` element has the class `dark`

**Scenario:** Dark class removed for light theme
- **Given** the theme state is `"light"`
- **When** the `ThemeProvider` renders
- **Then** the `<html>` element does not have the class `dark`

### Out of Scope

- System preference detection logic (Task 2)
- localStorage read/write (Task 3)
- Choosing initial theme — this provider accepts a default and applies it; the *source* of that default is handled by Tasks 2 and 3
- Styling or visual changes to any component

### References

- Tailwind CSS dark mode docs: https://tailwindcss.com/docs/dark-mode
- React Context API: https://react.dev/reference/react/createContext
- Files to create: `src/context/ThemeContext.tsx`, `src/hooks/useTheme.ts`

---

## Task 2: System Preference Detection

### Description

Users expect apps to respect their operating system's dark mode setting out of the box. This task wires up the browser's `prefers-color-scheme` media query to the theme context from Task 1, so the app automatically matches the OS theme on first load and responds in real time when the user changes their system setting (e.g., macOS auto-switching at sunset).

This task is specifically about *detection* — reading the system preference and pushing it into the theme context. It does not handle the manual toggle or persistence; those are Task 3. When both system detection and a persisted user preference exist, the persisted preference wins (Task 3 handles that priority logic).

**Technical decisions:**
- **`window.matchMedia('(prefers-color-scheme: dark)')` with an event listener** — this is the standard browser API. We attach a `change` listener so the app reacts live to OS-level theme switches without requiring a page reload.
- **Detection runs inside `ThemeProvider` (or a hook it calls), not in a separate provider** — keeping it co-located avoids a second context and simplifies the initialization sequence.
- **System preference is the *fallback*, not the authority** — if the user has explicitly chosen a theme via the toggle (persisted in localStorage by Task 3), that choice takes precedence. This task should call `setTheme` only when no persisted preference exists.
- **Cleanup the event listener on unmount** — standard React effect hygiene to prevent memory leaks.

### Acceptance Criteria

**Scenario:** App matches system dark mode on first visit
- **Given** the user has never visited the app before (no localStorage entry)
- **When** the user's OS is set to dark mode and the app loads
- **Then** the app renders in dark mode

**Scenario:** App matches system light mode on first visit
- **Given** the user has never visited the app before (no localStorage entry)
- **When** the user's OS is set to light mode and the app loads
- **Then** the app renders in light mode

**Scenario:** Live system preference change
- **Given** the app is open and no manual theme preference is stored
- **When** the user switches their OS from light to dark mode
- **Then** the app switches to dark mode without a page reload

**Scenario:** System change ignored when user has manual preference
- **Given** the user has previously selected light mode via the toggle (persisted in localStorage)
- **When** the OS switches to dark mode
- **Then** the app remains in light mode

### Out of Scope

- The manual toggle UI (Task 3)
- localStorage read/write logic (Task 3)
- Any visual/component styling (Task 5)
- Server-side rendering considerations

### References

- MDN `prefers-color-scheme`: https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme
- `window.matchMedia` API: https://developer.mozilla.org/en-US/docs/Web/API/Window/matchMedia
- Depends on: `ThemeContext` and `setTheme` from Task 1

---

## Task 3: Manual Toggle with localStorage Persistence

### Description

Users need the ability to override the system theme and have that choice remembered across sessions. This task builds a toggle component and the persistence layer that stores the user's explicit choice in `localStorage`.

The toggle sits in the app's header/navigation (or wherever the team decides — the important thing is it's globally accessible). When clicked, it switches between light and dark mode and writes the choice to `localStorage`. On subsequent visits, the app reads this stored value and uses it instead of the system preference.

This task also owns the priority logic: if a `localStorage` value exists, it wins over the system detection from Task 2. If no `localStorage` value exists, the system preference is used (Task 2 handles that).

**Technical decisions:**
- **`localStorage` key: `"theme"`, values: `"light"` | `"dark"`** — simple, human-readable, easy to debug in DevTools. No need for a more complex serialization format.
- **Clearing the preference restores system-following behavior** — if we later want a "use system" option in the toggle, removing the `localStorage` key is all it takes. The toggle in this task is two-state (light/dark), but the architecture supports a future three-state toggle (light/dark/system) without refactoring.
- **Toggle component receives theme state and setTheme from the `useTheme` hook** — it doesn't manage its own state. Single source of truth is the context.
- **Write to `localStorage` inside the toggle's click handler (or a wrapper around `setTheme`)** — not inside the context provider's effect. The provider doesn't know or care about persistence; that's this task's responsibility.
- **Accessible toggle** — the component should use a `<button>` with `aria-label` describing the current action (e.g., "Switch to dark mode"). Keyboard accessible by default since it's a native button.

### Acceptance Criteria

**Scenario:** User toggles to dark mode
- **Given** the app is in light mode
- **When** the user clicks the theme toggle
- **Then** the app switches to dark mode and `localStorage.getItem("theme")` returns `"dark"`

**Scenario:** User toggles to light mode
- **Given** the app is in dark mode
- **When** the user clicks the theme toggle
- **Then** the app switches to light mode and `localStorage.getItem("theme")` returns `"light"`

**Scenario:** Persisted preference loads on return visit
- **Given** the user previously selected dark mode (localStorage has `"theme": "dark"`)
- **When** the user opens the app in a new session
- **Then** the app loads in dark mode regardless of the system preference

**Scenario:** Toggle is accessible
- **Given** the toggle is rendered
- **When** inspected
- **Then** it is a `<button>` element with an `aria-label` that describes the action (e.g., "Switch to dark mode" or "Switch to light mode")

**Scenario:** Toggle is keyboard accessible
- **Given** the toggle button is focused
- **When** the user presses Enter or Space
- **Then** the theme toggles, same as a click

### Out of Scope

- Three-state toggle (light/dark/system) — two-state for now; architecture supports adding "system" later
- Syncing theme across multiple open tabs (would require `storage` event listener — not in this scope)
- Animated transition between themes (could be a follow-up)
- The visual design of the toggle icon (use a simple sun/moon icon or text label; exact design is not blocked on this task)

### References

- MDN localStorage: https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage
- Depends on: `useTheme` hook and `ThemeContext` from Task 1
- Files to create: `src/components/ThemeToggle.tsx`

---

## Task 4: Tailwind Dark Mode Configuration & Design Tokens

### Description

Before any component can be styled for dark mode, Tailwind needs to be configured for class-based dark mode, and the project needs a coherent set of design tokens (CSS custom properties or Tailwind theme extensions) that define the color palette for both themes.

Without this task, every component in Task 5 would have to independently pick dark mode colors, leading to an inconsistent palette. By defining tokens centrally, components just reference semantic names like `bg-surface`, `text-primary`, `border-subtle` and get the right color in both modes automatically.

This task is intentionally parallel with Task 1 — it touches Tailwind config and CSS, not React code. It can be worked on simultaneously.

**Technical decisions:**
- **`darkMode: 'class'` in `tailwind.config.js`** — required for the class-based strategy. This is the single line that enables `dark:` variant utilities.
- **CSS custom properties on `:root` and `.dark` selector** — define colors as custom properties (e.g., `--color-surface: 255 255 255` for light, `--color-surface: 15 23 42` for dark). Tailwind's `theme.extend.colors` references these via `rgb(var(--color-surface) / <alpha>)`.
- **Semantic color names, not literal colors** — use names like `surface`, `surface-alt`, `text-primary`, `text-secondary`, `text-muted`, `border-default`, `border-subtle`, `accent`, `accent-hover`. This keeps component markup readable and makes future palette changes trivial.
- **Keep the existing Tailwind color palette available** — don't remove default Tailwind colors. The semantic tokens are an addition, not a replacement. Existing hardcoded color classes (e.g., `bg-white`, `text-gray-900`) will be migrated in Task 5.
- **Minimum viable palette** — define enough tokens to cover backgrounds, text hierarchy, borders, and interactive states. Don't over-engineer; add tokens as Task 5 reveals the need.

### Acceptance Criteria

**Scenario:** Tailwind dark mode enabled
- **Given** the `tailwind.config.js` (or `tailwind.config.ts`) file
- **When** inspected
- **Then** it contains `darkMode: 'class'`

**Scenario:** Semantic color tokens defined for light mode
- **Given** the global CSS file (e.g., `src/index.css` or `src/globals.css`)
- **When** inspected
- **Then** `:root` defines CSS custom properties for at least: `--color-surface`, `--color-surface-alt`, `--color-text-primary`, `--color-text-secondary`, `--color-border`

**Scenario:** Semantic color tokens defined for dark mode
- **Given** the global CSS file
- **When** inspected
- **Then** `.dark` selector overrides the same custom properties with dark-appropriate values

**Scenario:** Tailwind config references custom properties
- **Given** `tailwind.config.js`
- **When** the `theme.extend.colors` section is inspected
- **Then** it maps semantic names (e.g., `surface`, `text-primary`) to the CSS custom properties using `rgb(var(--color-surface) / <alpha-value>)` syntax

**Scenario:** Existing Tailwind utilities still work
- **Given** a component using `bg-blue-500`
- **When** rendered
- **Then** it still renders correctly — default Tailwind colors are not removed

### Out of Scope

- Migrating existing components to use the new tokens (Task 5)
- React context or state management (Task 1)
- Toggle or detection logic (Tasks 2, 3)
- Dark mode variants for third-party component libraries (Task 5, if applicable)

### References

- Tailwind CSS dark mode config: https://tailwindcss.com/docs/dark-mode
- Tailwind CSS custom colors with CSS variables: https://tailwindcss.com/docs/customizing-colors#using-css-variables
- Files to modify: `tailwind.config.js` (or `.ts`), `src/index.css` (or `src/globals.css`)

---

## Task 5: Component Theme Migration

### Description

This is the largest task by volume: go through every existing component in the app and ensure it renders correctly in both light and dark mode. This means replacing hardcoded color utilities (like `bg-white`, `text-gray-900`, `border-gray-200`) with either semantic token classes from Task 4 (preferred) or paired light/dark utilities (e.g., `bg-white dark:bg-gray-900`).

The goal is not a pixel-perfect redesign — it's ensuring every component is *readable, usable, and visually coherent* in both themes. Text must have sufficient contrast against backgrounds, borders must be visible, interactive elements must be distinguishable.

This task depends on both Task 1 (the provider must be in place so the `dark` class is applied) and Task 4 (the semantic tokens must exist for components to reference).

**Technical decisions:**
- **Prefer semantic tokens over paired utilities** — `bg-surface` is better than `bg-white dark:bg-slate-900` because it's a single class, it's readable, and palette changes happen in one place. Use paired utilities only where a component needs a one-off color that doesn't fit a semantic token.
- **Migrate one component at a time, verifying visually in both modes** — don't batch-replace across all files without checking. Some components may have subtle color relationships (e.g., a card with a slightly different background than the page) that require care.
- **Check images and SVGs** — logos and icons with hardcoded fills may need `dark:` overrides or `currentColor` treatment.
- **Form elements need extra attention** — browser-default form styles (inputs, selects, textareas) often have hardcoded white backgrounds. These need explicit dark mode styling.
- **Shadow adjustments** — light-mode shadows (e.g., `shadow-md`) may not be visible on dark backgrounds. Consider `dark:shadow-lg` or `dark:shadow-none` with a border instead.

### Acceptance Criteria

**Scenario:** All components render correctly in light mode
- **Given** the theme is set to light
- **When** every page/route of the app is loaded
- **Then** all components render with the same visual quality as before this feature was implemented (no regressions)

**Scenario:** All components render correctly in dark mode
- **Given** the theme is set to dark
- **When** every page/route of the app is loaded
- **Then** all text is legible (WCAG AA contrast minimum), backgrounds are dark, borders are visible, and interactive elements are distinguishable

**Scenario:** Semantic tokens used where appropriate
- **Given** the migrated component source files
- **When** reviewed
- **Then** the majority of color classes use semantic tokens (`bg-surface`, `text-primary`, etc.) rather than paired `bg-white dark:bg-slate-900` utilities

**Scenario:** Form elements styled for dark mode
- **Given** the theme is set to dark
- **When** form elements (inputs, selects, textareas, buttons) are rendered
- **Then** they have visible borders, legible text, and appropriate background colors — not browser-default white

**Scenario:** No hardcoded colors remain without dark variants
- **Given** the migrated component source files
- **When** searched for hardcoded color utilities (e.g., `bg-white`, `text-black`, `border-gray-*` without a corresponding `dark:` variant or semantic token replacement)
- **Then** none are found (or any exceptions are documented with justification)

### Out of Scope

- Creating new components or layouts
- Redesigning the visual style of the app (only adapting existing styles for dark mode)
- Animations or transitions between themes
- Third-party component library theming (unless the library components are already in use and visually break in dark mode)

### References

- Depends on: Task 1 (ThemeProvider in place), Task 4 (semantic tokens defined)
- WCAG AA contrast requirements: https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html
- Files to modify: all component files in `src/components/`, page files, layout files

---

## Task 6: Integration Testing & Edge Cases

### Description

With all the pieces in place (context, detection, toggle, tokens, migrated components), this final task verifies that everything works together end-to-end and handles edge cases gracefully.

This task is where we catch the bugs that live in the seams between tasks — the system detection handing off to localStorage, the toggle writing and the provider reading, the initial flash of wrong theme, etc.

**Technical decisions:**
- **Test the initialization priority chain** — the app should: (1) check localStorage, (2) if empty, check system preference, (3) apply the result before first paint. If the wrong theme flashes briefly before the correct one loads, that's a bug (FOUC — Flash of Unstyled Content).
- **Prevent FOUC with a blocking script** — add a small inline `<script>` in `index.html` (before React mounts) that reads localStorage and applies the `dark` class to `<html>` synchronously. This prevents the flash. This is a well-known pattern in the dark mode community.
- **Write both unit tests and integration tests** — unit tests for the hook, context, and toggle component; integration tests (e.g., Cypress or Playwright) for the full flow: load app, check theme matches system, toggle, reload, verify persistence.
- **Test localStorage unavailability** — in private browsing or with storage disabled, the app should gracefully fall back to system preference without throwing.

### Acceptance Criteria

**Scenario:** No flash of wrong theme on load
- **Given** the user has `"theme": "dark"` in localStorage
- **When** the page loads
- **Then** the dark theme is applied before any content is visually rendered (no white flash)

**Scenario:** FOUC prevention script in HTML
- **Given** the `index.html` file
- **When** inspected
- **Then** there is an inline `<script>` before the React root that reads localStorage and applies the `dark` class to `<html>` synchronously

**Scenario:** Full flow — system detection to manual override
- **Given** a fresh browser (no localStorage) with OS set to dark mode
- **When** the app loads, then the user toggles to light mode, then reloads the page
- **Then** the app loads in dark (system), switches to light (toggle), and loads in light on reload (persisted override)

**Scenario:** localStorage unavailable
- **Given** localStorage is disabled (e.g., in a test environment simulating private browsing restrictions)
- **When** the app loads
- **Then** the app falls back to system preference detection without throwing errors, and the toggle still works for the current session (just not persisted)

**Scenario:** Unit tests pass
- **Given** the test suite
- **When** run
- **Then** tests cover: `useTheme` hook returns correct values, `ThemeProvider` applies/removes `dark` class, `ThemeToggle` calls `setTheme` and updates `localStorage`, system preference detection hook returns correct initial value

### Out of Scope

- Performance benchmarking
- Visual regression testing with screenshot comparison tools (nice to have, not required)
- Cross-browser testing beyond Chrome and Firefox
- E2E tests for every single component's dark mode appearance (spot-check a few representative components)

### References

- Depends on: all previous tasks (2, 3, 5 specifically)
- FOUC prevention pattern: https://github.com/pacocoursey/next-themes (reference implementation)
- Files to create: `src/__tests__/theme.test.tsx`, `src/__tests__/ThemeToggle.test.tsx`
- Files to modify: `public/index.html` (or equivalent entry HTML)
