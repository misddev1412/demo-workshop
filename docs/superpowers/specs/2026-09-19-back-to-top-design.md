# Back to top — Design

## Goal

Add an unobtrusive, accessible control that lets visitors return to the top of the long storefront page without competing with shopping and contact actions.

## Options considered

1. A fixed floating button that appears after scrolling. This is the selected approach because it stays reachable, preserves page space, and matches the compact controls already used by the storefront.
2. A permanent link in the footer. This requires reaching the bottom before it helps, so it does not solve navigation from the middle of the catalogue.
3. A permanently visible floating button. This is simpler but adds unnecessary visual noise in the first viewport.

## Interaction and visual design

- Render a circular button at the bottom-right edge of the viewport, using the existing green, cream, border, and shadow language.
- Keep it hidden and non-interactive near the top; reveal it after the page has scrolled 400 pixels.
- Use a small upward arrow as the visible affordance and the Vietnamese accessible name `Về đầu trang`.
- On activation, scroll the window to the top with smooth motion. When the operating system requests reduced motion, scroll immediately instead.
- Keep the control clear of the viewport edge on desktop and mobile. Its stacking order should place it above page content but below dialogs. The existing centered toast remains usable when both controls are visible.
- Preserve a visible focus treatment and a minimum 44-pixel touch target.

## Architecture

Create a focused client component in `app/components/back-to-top.tsx`. It owns only scroll visibility, reduced-motion detection, and the click action. Mount it once in the root layout so the behavior remains independent of page business logic and is available to future routes. Add component styles to `app/globals.css`.

## Testing

- A source-level contract test verifies the component is mounted globally, has the accessible label, uses a scroll threshold, and handles reduced-motion behavior.
- Run the complete Node test suite, lint, and production build.
- Browser verification checks hidden/visible states, positioning at desktop and mobile widths, and returning to the top after activation.

## Scope

No navigation, product, cart, checkout, contact, or data behavior changes. The existing uncommitted README update is excluded from this feature.
