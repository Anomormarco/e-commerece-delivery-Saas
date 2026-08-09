# DeliverHub Brand System

## Logo Direction

DeliverHub uses a circular delivery mark inspired by fast fulfillment and reusable commerce loops:

| Element | Meaning |
|---|---|
| Circular arrows | Delivery cycle, return flow, reusable commerce operations |
| Truck | Last-mile delivery and courier operations |
| Package | E-commerce order fulfillment |
| Green palette | Trust, movement, sustainable delivery, operational health |

Use the React logo component from `client/src/components/BrandLogo.tsx` for product UI. Keep the mark readable at small sizes and avoid placing it on busy backgrounds.

## Core Color Tokens

| Token | Hex | Usage |
|---|---:|---|
| `--color-primary` | `#0f172a` | Headline text, dark buttons, logo outline, high-emphasis UI |
| `--color-secondary` | `#f97316` | Primary actions, active tabs, current delivery step, key brand accents |
| `--color-tertiary` | `#22c55e` | Success states, completed delivery steps, positive operational highlights |
| `--color-neutral` | `#64748b` | Secondary text, inactive UI, neutral supporting details |
| `--brand-mint` | `#e8f1ff` | Light blue system background from the visual language board |
| `--line` | `#cbd5e1` | Borders and dividers |
| `--surface` | `#f8fbff` | App background |
| `--surface-strong` | `#e8f1ff` | Subtle panels and map blocks |
| `--blue` | `#2563eb` | Location, info, navigation support |
| `--warning` | `#f97316` | Warnings and pending states |
| `--danger` | `#dc2f32` | Errors and destructive states |

Legacy `--brand-*` variables remain in CSS as aliases so existing components keep working, but new UI should use the `--color-*` tokens above.

## Usage Rules

Use the navy primary for structure and high-contrast UI. Use orange for the main brand/action signal and active delivery states. Use green for success and completed workflow states. Use blue only for maps, location, and informational states. Use red only for errors, failed payments, and destructive actions.

Avoid building screens from one hue family. Pair navy and orange with white surfaces, light blue panels, neutral text, blue location cues, and green success states.
