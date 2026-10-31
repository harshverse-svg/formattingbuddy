# FormattingBuddy Design Specification (DESIGN.md)

> **Design Standard**: Linear / Notion high-craft utility with ambient photo mode.  
> **Surface Modes**: Primary: **Operate** (workspace, settings, editors) • Secondary: **Experience** (floating glass card wallpaper mode).  
> **Anti-Slop Craft Floor**: Zero clichéd AI tropes, zero eyebrow labels, zero gratuitous glowing blobs, strict WCAG AA contrast (≥ 4.5:1 body, ≥ 3:1 display).

---

## 1. Visual Identity & Brand Philosophy

FormattingBuddy converts raw, unstructured text and multi-format files (PDF, Word DOCX, Excel, PowerPoint, Text, Images) into production-grade structured documents with headings, tables, Mermaid diagrams, Chart.js charts, and Leaflet maps.

- **Design Philosophy**: Minimal, modern, quiet precision. Chrome recedes to let user content lead.
- **Surface Elevation**: Grounded tone steps rather than harsh 1px nested card outlines.
- **Atmospheric Flexibility**: Dual visual states—a clean, distraction-free solid workspace (Light, Dark, Slate) and a personalized floating glass card atmosphere with curated wallpapers.

---

## 2. Color System & Design Tokens

### Core Color Foundations
| Token | Light (Soft Blue) | Dark (Midnight) | Slate (Technical) |
|---|---|---|---|
| `--bg` | `#EAF0FA` | `#0D1220` | `#131823` |
| `--surface` | `#F5F8FD` | `#151B2D` | `#1B2232` |
| `--surface-raised` | `#FFFFFF` | `#1C243B` | `#232C40` |
| `--surface-subtle` | `#E2EAF7` | `#101626` | `#161D2B` |
| `--border` | `#D3DCEC` | `#25304A` | `#2D374D` |
| `--text` | `#1B2433` | `#E6EAF5` | `#EDF2F7` |
| `--text-secondary`| `#3F4D67` | `#B4BFD8` | `#B0BCCE` |
| `--text-muted` | `#5B6780` | `#8E9AB8` | `#8692A6` |
| `--accent` | `#4F5BD5` | `#7C86F2` | `#6366F1` |
| `--accent-hover` | `#434EB8` | `#6B75E0` | `#5254D8` |
| `--accent-subtle`| `rgba(79, 91, 213, 0.12)` | `rgba(124, 134, 242, 0.16)` | `rgba(99, 102, 241, 0.16)` |

### Status Indicators
- **Success / Validated**: Teal (`#10B981` / `#059669`)
- **Warning / In-Progress**: Amber (`#F59E0B` / `#D97706`)
- **Danger / Error**: Rose (`#F43F5E` / `#E11D48`)
- **Information / Notice**: Sky (`#0284C7` / `#38BDF8`)

---

## 3. Typography Hierarchy & Rhythm

FormattingBuddy relies on platform-native typefaces for instantaneous zero-download rendering, supplemented by Noto TrueType fonts for multi-language vector PDF exports.

- **Body Measure**: Strict `65ch` to `75ch` line length for optimal sustained reading comfort.
- **Headline Rhythm**: Headlines limited to 2 lines maximum; 1.5x more margin above headings than below.
- **Font Stack**:
  - **Interface**: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`
  - **Code & Markdown**: `ui-monospace, SFMono-Regular, "Cascadia Code", Menlo, Monaco, Consolas, monospace`
  - **Document Export**: Bundled Noto Sans (Latin) & Noto Sans Devanagari (Hindi)

---

## 4. Layout Architecture & Surface Modes

### Mode 1: Solid Utility (Default)
- **Header**: Compact 56px sticky bar with wordmark, PWA install indicator, conversion history, shortcuts cheatsheet, theme toggle, settings, and lock trigger.
- **Split View**: Two-panel layout on desktop (Source Input on left, Formatted Preview on right).
- **Interactive Split Resizer**: A 8px interactive column resizer between panels allowing flexible split ratios (20% to 80%) with double-click reset to 50/50 balance.
- **Mobile Responsive**: Smoothly shifts into dedicated tab navigation (`Input Document` / `Formatted Preview`) on viewport widths `< 900px`.

### Mode 2: Floating Glass Card Mode (Stage D)
- **Atmospheric Layer**: 8 bundled responsive WebP wallpapers or user-uploaded photos.
- **Floating Cards**: 16px outer margins, 24px border-radius, soft shadows (`0 8px 32px rgba(0,0,0,0.22)`), and translucent glass surface opacity (`50%` to `100%`).
- **GPU Blur**: Optional backdrop blur (`16px`), disabled automatically when Low Power Mode or `prefers-reduced-motion` is active.
- **Pill Controls**: Smooth pill buttons with `-2px` hover lift and subtle accent glow.

---

## 5. Interaction Thesis & Micro-Interactions

Every motion serves a communicative purpose:
1. **Button Hover**: `140ms–180ms` ease-out hover lift (`transform: translateY(-2px)`) with subtle tone step.
2. **Tab Transitions**: Segmented pill slider with instantaneous contrast and zero visual jank.
3. **Modal Dialogs**: `200ms` cubic-bezier entrance (`transform: translateY(10px) -> 0; opacity: 0 -> 1`).
4. **Code & Table Copy**: Seamless clipboard write with immediate visual badge confirmation ("Copied!").
5. **Keyboard Shortcuts**:
   - `Ctrl + Enter`: Trigger conversion pipeline
   - `Ctrl + E`: Toggle interactive Markdown edit mode
   - `Ctrl + Shift + P`: Toggle simulated A4 Print View
   - `Ctrl + Shift + H`: Open Conversion History
   - `Ctrl + Shift + S`: Open Appearance & Settings
   - `?` or `Ctrl + /`: Open Keyboard Shortcuts cheatsheet
   - `Esc`: Dismiss any active modal or dropdown

---

## 6. Secondary Surface & Accessibility Details

- **Themed Selection**: `::selection` uses `var(--accent)` with high-contrast text.
- **Themed Caret**: Form inputs and textareas use `caret-color: var(--accent)`.
- **Accessible Focus**: `:focus-visible` ring (`2px solid var(--accent); outline-offset: 1px`).
- **Themed Scrollbars**: Slim `6px` trackless scrollbars that match active theme borders.
- **Data Tables**: Striped, responsive horizontal scroll containers with one-click CSV copy.
