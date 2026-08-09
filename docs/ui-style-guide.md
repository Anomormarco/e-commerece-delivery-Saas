# DeliverHub UI Style Guide

Version: v0.1  
Date: 2026-07-28

## 1. Visual Direction

DeliverHub-ийн эхний UI хэв шинж нь цэвэр, ажиллагаанд төвлөрсөн, delivery/tracking мэдрэмжтэй байна. Customer тал нь minimal, төв хэсэгт card-уудтай, цайвар саарал background дээр white surface ашиглана. Admin/store тал нь илүү dashboard density-тэй боловч ижил color token, border, radius, spacing хэрэглэнэ.

Бүх хэрэглэгчид харагдах текст Монгол хэл дээр байна. Техникийн нэр томьёо зайлшгүй үед (`RBAC`, `QPay`, `tenant`, `DAN`, `OTP`, `API`) богино байдлаар ашиглаж болно, гэхдээ тайлбар, товч, navigation, status, error message, empty state, notification copy Монгол байна.

## 2. Core Palette

| Token | Hex | Usage |
|---|---|---|
| Ink | `#0f172a` | Main text, dark buttons, high contrast UI |
| Muted text | `#64748b` | Secondary text |
| Border | `#dde5ef` | Card/input/table border |
| Surface | `#f7f9fc` | App background, subtle panels |
| Strong surface | `#eef3fb` | Map/card inner blocks |
| Delivery orange | `#f97316` | Active tab, active timeline, primary delivery CTA |
| Success green | `#22c55e` | Completed timeline, success status |
| Action blue | `#2563eb` | Current GPS marker, info badges |

## 3. Customer Tracking Pattern

Customer order tracking page must keep this structure:

- Top tab bar: `Явц хянах`, `Захиалгын түүх`
- Full-width light gray page background, not a floating outer card
- Tab bar spans the full viewport width with a white background and thin bottom border
- Centered white cards, max width around `590px`
- Large soft card radius around `20px`
- Thin border and very soft shadow
- Orange active underline on selected tab
- Receipt card first: order number, store name, district, status badge, item rows, total
- Timeline card second: vertical progress, green completed steps, orange current step, pale disabled future step
- Courier card third: courier name, rating, vehicle type, plate number, call action, map block
- Secret code card last: 4 large dark rounded digit blocks

## 4. Spacing And Shape

- Page card width: `min(590px, 100%)`
- Customer tracking shell width: `100%`
- Customer page card padding: `26px`
- Card radius: `20px` for customer cards, `8px` for admin/store operational surfaces
- Border: `1px solid #dde5ef`
- Shadow: subtle only, avoid heavy floating effects
- Timeline icon size: `44px`
- Secret code digit size: about `70px x 80px`

## 5. Interaction States

| State | Style |
|---|---|
| Active route/tab | Orange text + orange underline |
| Completed delivery step | Green circular icon |
| Current delivery step | Orange circular icon |
| Pending delivery step | Pale gray icon + reduced opacity |
| Courier location | Blue dot on light map surface |
| Customer address action | Green pill button |

## 6. Do Not Drift

- Do not make customer tracking look like a marketing landing page.
- Do not use heavy gradients or decorative backgrounds on customer tracking.
- Do not over-round operational dashboard cards.
- Do not use a one-color orange-only interface; orange is an accent.
- Do not show courier personal phone number directly; use masked call/chat.
