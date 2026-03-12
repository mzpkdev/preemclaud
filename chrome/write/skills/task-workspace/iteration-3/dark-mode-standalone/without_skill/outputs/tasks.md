# Dark Mode Implementation — Task Decomposition

## Overview

Add dark mode support to an existing React + Tailwind CSS application with system preference detection, a persistent manual toggle, and full theme coverage across all components.

---

## Task 1: Configure Tailwind CSS for Dark Mode

**Goal:** Enable Tailwind's `darkMode: 'class'` strategy so dark styles can be toggled via a CSS class on the root element.

**Steps:**
- Update `tailwind.config.js` (or `tailwind.config.ts`) to set `darkMode: 'class'`.
- Verify the build pipeline picks up the change (run a dev build, confirm `dark:` variants compile).

**Acceptance criteria:**
- `dark:` utility classes are available and functional when the `dark` class is present on `<html>`.

---

## Task 2: Create the Theme Context and Provider

**Goal:** Build a React context that manages the current theme state, exposes a toggle function, and applies the `dark` class to the document root.

**Steps:**
- Create `ThemeContext` with values: `theme` (`'light' | 'dark' | 'system'`), `resolvedTheme` (`'light' | 'dark'`), and `toggleTheme` / `setTheme` functions.
- Create `ThemeProvider` component that wraps the app.
- On mount, read the stored preference from `localStorage` (key: e.g. `theme`). If none exists, default to `'system'`.
- When theme is `'system'`, use `window.matchMedia('(prefers-color-scheme: dark)')` to resolve the actual theme.
- Add/remove the `dark` class on `<html>` whenever `resolvedTheme` changes.
- Persist the user's explicit choice to `localStorage` on every change.

**Acceptance criteria:**
- Context provides current theme and setter.
- `dark` class toggles on `<html>` correctly.
- Preference survives a full page reload.

---

## Task 3: Implement System Preference Detection and Live Sync

**Goal:** Automatically respond to OS-level theme changes when the user has not set a manual override (i.e., preference is `'system'`).

**Steps:**
- Inside `ThemeProvider`, attach a `matchMedia` change listener for `(prefers-color-scheme: dark)`.
- When the listener fires and the stored preference is `'system'`, update `resolvedTheme` and toggle the `dark` class accordingly.
- Clean up the listener on unmount.

**Acceptance criteria:**
- Switching the OS from light to dark (and back) while the app is open updates the theme in real time, provided the user has not chosen a manual override.

---

## Task 4: Build the Theme Toggle UI Component

**Goal:** Give users a visible control to switch between light, dark, and system modes.

**Steps:**
- Create a `ThemeToggle` component (button or dropdown).
- Display the current mode with an appropriate icon (sun, moon, monitor/system).
- On interaction, cycle through modes or present all three options.
- Consume `ThemeContext` to read and write the theme.

**Acceptance criteria:**
- Toggle is accessible (keyboard navigable, has aria labels).
- Selecting a mode immediately updates the UI and persists to `localStorage`.
- Selecting "System" defers to OS preference.

---

## Task 5: Define the Dark Mode Color Palette / Design Tokens

**Goal:** Establish the specific colors that will be used in dark mode so component work is consistent.

**Steps:**
- Audit the current color usage across the app (backgrounds, text, borders, shadows, rings, etc.).
- Define a dark palette — either extend Tailwind's theme with CSS custom properties or document the `dark:` class mappings.
- If using CSS variables, add them in a global stylesheet scoped under `.dark` (e.g., `--color-bg-primary`, `--color-text-primary`).
- Document the mapping so all subsequent component work is consistent.

**Acceptance criteria:**
- A clear, documented mapping from every light-mode color to its dark-mode counterpart.
- No ambiguity for developers working on individual components.

---

## Task 6: Update Layout and Shell Components

**Goal:** Apply dark mode styles to the top-level structural components that define the overall page appearance.

**Components typically included:**
- Root layout / `App` wrapper (background, text color defaults)
- Header / Navbar
- Sidebar (if applicable)
- Footer
- Page containers / wrappers

**Steps:**
- Add `dark:` Tailwind classes for background, text, and border colors.
- Verify transitions between themes look smooth (consider adding `transition-colors` if desired).

**Acceptance criteria:**
- The overall page chrome looks correct in both light and dark mode.
- No flash of wrong theme on load (handled by Task 2's early script or SSR considerations).

---

## Task 7: Update Form and Input Components

**Goal:** Ensure all interactive form elements render correctly in dark mode.

**Components typically included:**
- Text inputs, textareas, selects
- Checkboxes, radio buttons, switches
- Buttons (all variants: primary, secondary, ghost, destructive, etc.)
- Labels, helper text, error messages

**Steps:**
- Add `dark:` classes for backgrounds, borders, text, placeholder text, focus rings, and disabled states.
- Test each interactive state (hover, focus, active, disabled) in both themes.

**Acceptance criteria:**
- All form elements are legible and visually consistent in dark mode.
- Focus indicators remain accessible (sufficient contrast).

---

## Task 8: Update Data Display Components

**Goal:** Apply dark styles to components that present information.

**Components typically included:**
- Cards
- Tables
- Lists
- Badges / tags / chips
- Modals / dialogs
- Tooltips / popovers
- Alerts / notifications / toasts

**Steps:**
- Add `dark:` classes for each component's background, text, border, and shadow.
- Pay attention to elevation / layering — darker surfaces should use slightly lighter shades in dark mode to convey depth.

**Acceptance criteria:**
- All data display components are readable and visually coherent in dark mode.
- Layered elements (modals over cards, tooltips over content) maintain visual hierarchy.

---

## Task 9: Update Navigation and Feedback Components

**Goal:** Theme remaining interactive and feedback-oriented components.

**Components typically included:**
- Breadcrumbs
- Tabs
- Pagination
- Progress bars / spinners / skeletons
- Dropdown menus
- Accordions

**Steps:**
- Add `dark:` classes as appropriate.
- Ensure active / selected states are clearly distinguishable in dark mode.

**Acceptance criteria:**
- Active states, hover states, and loading indicators are clearly visible in dark mode.

---

## Task 10: Handle Images, SVGs, and Third-Party Embeds

**Goal:** Ensure non-CSS visual assets look appropriate in dark mode.

**Steps:**
- Audit inline SVGs — update fill/stroke colors to use `currentColor` or add `dark:` class overrides.
- For images that look poor on dark backgrounds (e.g., logos with transparent backgrounds), provide dark-mode variants or add subtle background/padding.
- Check third-party widgets or embeds (maps, charts, embedded iframes) and apply their dark mode APIs or overlays if available.

**Acceptance criteria:**
- No visual artifacts from images or SVGs clashing with dark backgrounds.
- Charts and third-party content are readable.

---

## Task 11: Prevent Flash of Incorrect Theme (FOIT)

**Goal:** Eliminate the brief flash of light mode that can appear before React hydrates.

**Steps:**
- Add a small blocking `<script>` in the `<head>` of `index.html` (or the equivalent entry point) that reads `localStorage` and `matchMedia`, then sets the `dark` class on `<html>` before any paint.
- Ensure this script is synchronous and runs before the main bundle.

**Acceptance criteria:**
- On a hard refresh with dark mode selected, the page never flashes white.
- On a hard refresh with system preference set to dark, the page never flashes white.

---

## Task 12: Testing

**Goal:** Verify the entire dark mode implementation works correctly.

**Steps:**
- Write unit tests for `ThemeProvider` logic: default to system, persist to localStorage, read from localStorage, respond to matchMedia changes.
- Write unit tests for `ThemeToggle`: cycling modes, rendering correct icons.
- Write integration / visual regression tests: snapshot key pages in both themes.
- Manual QA pass: walk through every page/route in both modes, checking for contrast issues, missing dark styles, and broken layouts.

**Acceptance criteria:**
- All tests pass.
- No component is missing dark mode styles.
- WCAG AA contrast ratios are met in both themes.

---

## Dependency Graph

```
Task 1  (Tailwind config)
  └─► Task 2  (Theme context + provider)
        ├─► Task 3  (System preference detection)
        ├─► Task 4  (Toggle UI component)
        └─► Task 5  (Color palette / tokens)
              ├─► Task 6   (Layout / shell)
              ├─► Task 7   (Forms / inputs)
              ├─► Task 8   (Data display)
              ├─► Task 9   (Navigation / feedback)
              └─► Task 10  (Images / SVGs / embeds)
                    └─► Task 11 (Flash prevention)
                          └─► Task 12 (Testing — after all else)
```

Tasks 6 through 10 can be parallelized. Task 12 should run last as a final verification pass.
