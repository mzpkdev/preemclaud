# Dark Mode Support Tasks
> From: **prompt** | Codename: **velvet-lantern**

**Goal:** Add full dark mode support to the React app with system preference detection, a persistent manual toggle, and theme coverage across all existing components using Tailwind CSS.

## Task Overview

| # | Task | Depends on | Parallel |
|---|------|-----------|----------|
| 1 | Theme infrastructure and context provider | — | Yes |
| 2 | System preference detection | 1 | No |
| 3 | Manual toggle with localStorage persistence | 1 | No |
| 4 | Tailwind dark mode configuration | — | Yes |
| 5 | Component theme audit and migration | 1, 4 | No |

---

## Task 1: Theme Infrastructure and Context Provider

### Description

This task establishes the foundational plumbing that every other dark mode task depends on. The app currently has no concept of a "theme" — there is no context, no state, and no way for components to know whether they should render in light or dark mode.

The deliverable is a React context provider that holds the current theme state (`light`, `dark`, or `system`) and exposes it to the entire component tree. This provider becomes the single source of truth for theming. It should sit near the root of the app so every component can consume the theme without prop drilling.

The provider needs to manage three concerns: reading an initial value (from localStorage or system preference — wired in Tasks 2 and 3), exposing the current resolved theme (always `light` or `dark`, never `system`), and exposing a setter so the toggle component can update it.

**Technical decisions:**
- Use React Context + a custom hook pattern rather than a state management library — this is UI-local state, not app data, and adding a Redux/Zustand dependency for a boolean is unnecessary overhead.
- Store a three-value preference (`light`, `dark`, `system`) but resolve it to a two-value effective theme (`light`, `dark`) before exposing to consumers. This keeps consuming components simple — they never have to interpret "system" themselves.
- Place the provider at the app root (wrapping the router/layout) so theme is available everywhere without additional nesting.

### Acceptance Criteria

**Scenario:** Theme context is available throughout the app
- **Given** the theme provider wraps the root of the application
- **When** any descendant component calls the theme hook
- **Then** it receives the current effective theme (`light` or `dark`) and a function to update the preference

**Scenario:** Effective theme resolves correctly from preference
- **Given** the user preference is set to `dark`
- **When** a component reads the effective theme
- **Then** the value is `dark`

**Scenario:** Default theme when no preference exists
- **Given** no preference has been stored and system detection is not yet wired
- **When** the app loads
- **Then** the effective theme defaults to `light`

### Out of Scope

- System preference detection logic (Task 2)
- localStorage read/write (Task 3)
- Any UI toggle component
- Modifying existing components to use theme values

### References

- App entry point / root component where the provider will be mounted
- Existing context providers in the app (follow the same pattern for consistency)

---

## Task 2: System Preference Detection

### Description

Users increasingly expect apps to match their operating system theme. This task wires the theme provider (Task 1) to the browser's `prefers-color-scheme` media query so the app automatically follows the OS setting when the user preference is `system`.

The detection must be reactive — if the user changes their OS theme while the app is open (e.g., macOS auto-switching at sunset), the app should update immediately without a page reload.

This task modifies the theme provider's initialization and adds a listener. It does not add any UI — the user can't yet choose "system" as a preference; that comes with the toggle (Task 3). But when "system" is the active preference (including as the default), the resolved theme should track the OS.

**Technical decisions:**
- Use `window.matchMedia('(prefers-color-scheme: dark)')` — this is the standard API, supported in all modern browsers. No polyfill needed.
- Attach a `change` event listener on the MediaQueryList for live updates. Clean it up on unmount to prevent memory leaks.
- When the stored preference is `system`, the resolved effective theme should reflect the current OS setting. When the preference is explicitly `light` or `dark`, the media query result is ignored.

### Acceptance Criteria

**Scenario:** App matches OS dark mode on first load
- **Given** no explicit preference has been stored and the OS is set to dark mode
- **When** the app loads
- **Then** the effective theme is `dark`

**Scenario:** App matches OS light mode on first load
- **Given** no explicit preference has been stored and the OS is set to light mode
- **When** the app loads
- **Then** the effective theme is `light`

**Scenario:** Live update when OS theme changes
- **Given** the user preference is `system` and the OS is currently in light mode
- **When** the OS switches to dark mode
- **Then** the app's effective theme updates to `dark` without a page reload

**Scenario:** Explicit preference overrides system detection
- **Given** the user has explicitly selected `light` as their preference
- **When** the OS is set to dark mode
- **Then** the effective theme remains `light`

### Out of Scope

- The toggle UI that lets users select "system" as an option
- Server-side rendering considerations for `prefers-color-scheme`
- Detecting other system preferences (high contrast, reduced motion)

### References

- Theme context provider (Task 1)
- MDN documentation for `prefers-color-scheme` media query

---

## Task 3: Manual Toggle with localStorage Persistence

### Description

Users need a way to override the system-detected theme and have that choice remembered across sessions. This task delivers two things: a toggle component that lets the user switch between light, dark, and system modes, and the persistence layer that saves the choice to localStorage.

The toggle should offer three options — Light, Dark, and System — rather than a simple on/off switch. "System" defers to the OS preference (Task 2). The selected option persists to localStorage so it survives page reloads and new sessions.

On app startup, the theme provider should check localStorage first. If a value exists, use it. If not, default to `system` (which then defers to OS detection from Task 2).

**Technical decisions:**
- Use localStorage (not cookies or sessionStorage) — this is a client-side-only preference, doesn't need to be sent to the server, and should persist beyond the session.
- Use a consistent, namespaced key (e.g., `theme-preference`) to avoid collisions with other localStorage usage in the app.
- The toggle should be a three-way control (Light / Dark / System), not a binary switch. A binary switch forces users to choose between "manual dark" and "whatever the system says" with no way to force light mode, which is a common complaint.
- Read localStorage synchronously during provider initialization to avoid a flash of the wrong theme on load.

### Acceptance Criteria

**Scenario:** Preference persists across page reloads
- **Given** the user selects `dark` from the toggle
- **When** the page is reloaded
- **Then** the app loads in dark mode without a flash of light mode

**Scenario:** System option defers to OS
- **Given** the user selects `system` from the toggle and the OS is in dark mode
- **When** the preference is applied
- **Then** the effective theme is `dark`

**Scenario:** First visit with no stored preference
- **Given** localStorage has no theme preference stored
- **When** the app loads
- **Then** the preference defaults to `system`

**Scenario:** Toggle updates theme immediately
- **Given** the app is in light mode
- **When** the user selects `dark` from the toggle
- **Then** the app switches to dark mode immediately without a page reload

**Scenario:** localStorage is unavailable
- **Given** localStorage is not accessible (e.g., private browsing restrictions)
- **When** the app loads
- **Then** the app still functions with the `system` default and the toggle works for the current session

### Out of Scope

- Visual design or styling of the toggle component beyond functional correctness (theming the toggle itself is covered in Task 5)
- Syncing preference across tabs in real-time (nice-to-have, not required)
- Server-side persistence of the preference

### References

- Theme context provider (Task 1)
- Existing UI component patterns in the app (buttons, dropdowns) for consistent toggle design
- App header/navigation where the toggle will most likely be placed

---

## Task 4: Tailwind Dark Mode Configuration

### Description

Tailwind CSS supports dark mode through two strategies: `media` (follows `prefers-color-scheme` automatically) and `class` (applies dark styles when a specific class is present on an ancestor element). Since this feature includes a manual toggle that can override the system preference, the `class` strategy is required — the `media` strategy can't be overridden by JavaScript.

This task configures Tailwind to use the `class` dark mode strategy and wires the theme provider's resolved theme to the DOM. When the effective theme is `dark`, a `dark` class must be present on the `<html>` element. When the effective theme is `light`, the class must be absent. This is the bridge between React state and Tailwind's styling system.

This is a configuration and wiring task — it does not involve updating any component styles. That happens in Task 5.

**Technical decisions:**
- Use `darkMode: 'class'` in the Tailwind config rather than `'media'`. The `class` strategy is the only one that supports JavaScript-controlled toggling. The `media` strategy would ignore the manual toggle entirely.
- Apply the `dark` class to the `<html>` element (not `<body>` or a wrapper div). Tailwind's `dark:` variant looks up the DOM tree for the `dark` class, and placing it on `<html>` ensures it works for every element on the page including things rendered in portals.
- Use a side effect (e.g., `useEffect` in the theme provider) to synchronize the class with the effective theme. This keeps the DOM manipulation co-located with the theme state.

### Acceptance Criteria

**Scenario:** Tailwind dark variant activates in dark mode
- **Given** the effective theme is `dark`
- **When** the `<html>` element is inspected
- **Then** it has the `dark` class, and Tailwind `dark:` utility classes apply their styles

**Scenario:** Tailwind dark variant deactivates in light mode
- **Given** the effective theme is `light`
- **When** the `<html>` element is inspected
- **Then** it does not have the `dark` class, and `dark:` utility classes are inactive

**Scenario:** Theme switch updates the DOM class
- **Given** the app is in light mode
- **When** the user switches to dark mode
- **Then** the `dark` class is added to `<html>` and dark styles take effect immediately

**Scenario:** No flash of incorrect theme on load
- **Given** the stored preference is `dark`
- **When** the page loads
- **Then** the `dark` class is applied before the first paint, preventing a flash of light-themed content

### Out of Scope

- Updating any component styles to use `dark:` variants (Task 5)
- Adding custom dark mode colors to the Tailwind theme
- CSS-in-JS or styled-components — this app uses Tailwind utility classes

### References

- Tailwind CSS configuration file
- Theme context provider (Task 1)
- App's HTML entry point (for the `<html>` element manipulation)

---

## Task 5: Component Theme Audit and Migration

### Description

This is the largest task by volume and the one that makes dark mode actually visible to users. Every existing component that uses hardcoded colors — whether through Tailwind utility classes like `bg-white`, `text-gray-900`, or through inline styles — needs to gain dark mode equivalents using Tailwind's `dark:` variant.

Start with an audit: go through every component and identify hardcoded color usage. Then systematically add `dark:` counterparts. For example, `bg-white` becomes `bg-white dark:bg-gray-900`, `text-gray-900` becomes `text-gray-900 dark:text-gray-100`.

Prioritize consistency. Define a dark mode color palette up front (background, surface, text primary, text secondary, border, etc.) and apply it uniformly rather than picking dark colors ad-hoc per component. This palette should be documented in the Tailwind config as semantic color tokens or in a shared reference so all components use the same values.

**Technical decisions:**
- Use Tailwind's `dark:` variant prefix on utility classes rather than conditional className logic in JavaScript. This keeps the styling declarative and co-located with the existing light styles.
- Define semantic color tokens in the Tailwind config (e.g., `bg-surface`, `text-primary`) that map to different values in light and dark modes, using CSS custom properties. This reduces duplication — instead of adding `dark:bg-gray-900` to every component, components use `bg-surface` and the token resolves correctly in both themes. This is an investment that pays off as the app grows.
- Handle images, shadows, and borders — not just background and text colors. Shadows may need to be stronger or use different colors in dark mode. Borders often need to shift from light grays to dark grays.

### Acceptance Criteria

**Scenario:** All pages render correctly in dark mode
- **Given** the app is in dark mode
- **When** every page and component is visually inspected
- **Then** there are no unreadable text areas, invisible elements, or jarring color mismatches

**Scenario:** All pages render correctly in light mode (no regressions)
- **Given** the app is in light mode
- **When** every page and component is visually inspected
- **Then** the appearance is identical to before this feature was implemented

**Scenario:** Semantic color tokens are used consistently
- **Given** the Tailwind config defines semantic tokens for dark mode
- **When** a new component is built
- **Then** it can adopt both themes by using semantic tokens without any dark-mode-specific work

**Scenario:** Interactive states work in both themes
- **Given** a button or link component in dark mode
- **When** the user hovers, focuses, or clicks it
- **Then** the hover/focus/active states are visible and have appropriate contrast

**Scenario:** Third-party or embedded content is handled
- **Given** the app includes third-party widgets, iframes, or user-generated content
- **When** dark mode is active
- **Then** these elements either adapt gracefully or are visually contained so they don't break the dark mode experience

### Out of Scope

- Creating new components solely for dark mode
- Redesigning existing components beyond color/contrast changes
- Animated transitions between light and dark themes
- Per-component theme overrides (e.g., a component that's always light regardless of app theme)

### References

- Every component in the app's component directory
- Tailwind CSS configuration file (for defining semantic tokens)
- WCAG 2.1 AA contrast ratio guidelines (4.5:1 for normal text, 3:1 for large text)
