# ChatGPT UI Style Guide for CoTailor
**Last Updated:** 2026-07-03

---

## 📌 Overview

CoTailor's UI has been completely redesigned to match **ChatGPT's modern, clean aesthetic**. This guide documents all design decisions, color values, spacing, and component patterns.

---

## 🎨 Color Palette

### Primary Colors
| Name | Value | Usage |
|------|-------|-------|
| **Accent** | `#10a37f` | Primary CTAs, success states, active elements |
| **Accent Light** | `#19c37d` | Hover states, gradients, highlights |
| **Accent Hover** | `#0d8659` | Darker hover alternative |

### Backgrounds
| Name | Value | Contrast | Usage |
|------|-------|----------|-------|
| **BG Primary** | `#0d0e15` | Main page background |
| **BG Secondary** | `#1a1b26` | Cards, sections |
| **BG Tertiary** | `#2a2b35` | Subtle backgrounds |
| **Card BG** | `#1a1b26` | Card backgrounds |
| **Card Hover** | `#25262f` | Interactive card states |

### Text
| Name | Value | WCAG | Usage |
|------|-------|------|-------|
| **Text Primary** | `#ececf1` | AA | Main text, headings |
| **Text Secondary** | `#b4b8c0` | AA | Subtitle, secondary text |
| **Text Tertiary** | `#8b8d98` | AA | Helper text, hints |

### Semantic
| State | Color | Usage |
|-------|-------|-------|
| **Success** | `#19c37d` | Confirmations, checkmarks, resolved items |
| **Warning** | `#f5a623` | Caution, attention-needed items |
| **Error** | `#d64545` | Errors, blocking, critical alerts |
| **Info** | `#1e90ff` | Information badges, help text |

### Borders
| Name | Value | Usage |
|------|-------|-------|
| **Border Color** | `#413f47` | Default borders |
| **Border Light** | `#565869` | Hover borders |

---

## 📐 Typography

### Font Stack
```css
--font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif;
--font-mono: 'Menlo', 'Monaco', 'Courier New', monospace;
```

### Font Sizes & Weights
| Element | Size | Weight | Letter Spacing |
|---------|------|--------|-----------------|
| **H1** | 2.25-3rem | 700 | -0.5px |
| **H2** | 1.875-2rem | 700 | -0.3px |
| **H3** | 1.1-1.15rem | 600 | normal |
| **Body** | 0.95-1rem | 400-500 | normal |
| **Small** | 0.8-0.85rem | 500 | normal |
| **Label** | 0.75-0.85rem | 600 | 0.05-0.08em (uppercase) |

### Line Heights
| Context | Height |
|---------|--------|
| Headings | 1.2 |
| Body Text | 1.6-1.8 |
| Form Labels | 1.4 |

---

## 🎯 Spacing System

**Base Unit:** 4px (multiple of 4px throughout)

| Size | Value | Usage |
|------|-------|-------|
| **xs** | 4px | Small gaps, list spacing |
| **sm** | 8px | Element padding, small margins |
| **md** | 12px | Medium spacing |
| **lg** | 16px | Normal padding, card spacing |
| **xl** | 20px | Large sections |
| **2xl** | 24px | Header/footer spacing |
| **3xl** | 32px | Major sections |
| **4xl** | 40-48px | Hero, CTAs |
| **5xl** | 60px | Page padding |

---

## 🔘 Components

### Buttons

#### Primary Button
```css
background: linear-gradient(135deg, var(--accent) 0%, var(--accent-light) 100%);
color: white;
box-shadow: 0 4px 12px rgba(16, 163, 127, 0.3);
border-radius: 8px;
font-weight: 600;
padding: 0.75rem 1.5rem;
```

**States:**
- **Default:** Gradient + shadow
- **Hover:** Enhanced gradient (reversed), larger shadow, -1px translateY
- **Active:** Slightly darker gradient
- **Disabled:** 50% opacity

#### Secondary Button
```css
background: var(--card-bg);
color: var(--text-secondary);
border: 1px solid var(--border-color);
border-radius: 8px;
```

**States:**
- **Hover:** Background changes to `var(--card-hover-bg)`, border becomes `var(--border-light)`, text becomes `var(--text-primary)`

#### Tertiary Button
Similar to secondary, no border by default.

### Cards

```css
background: var(--card-bg);
border: 1px solid var(--border-color);
border-radius: 12px;
padding: 20px;
box-shadow: 0 2px 4px 0 rgba(0, 0, 0, 0.5);
transition: all 0.2s ease;
```

**On Hover:**
- Border → `var(--border-light)`
- Background → `var(--card-hover-bg)`
- Shadow → `0 4px 12px 0 rgba(0, 0, 0, 0.5)`
- Transform (if hoverable) → `translateY(-2px)`

### Badges

```css
padding: 4px 10px;
border-radius: 6px;
font-size: 0.8rem;
font-weight: 600;
text-transform: uppercase;
letter-spacing: 0.05em;
border: 1px solid rgba(color, 0.2);
background: linear-gradient(135deg, rgba(color, 0.1) 0%, rgba(color, 0.05) 100%);
```

**Variants:**
- **Success:** Green (#10a37f)
- **Warning:** Orange (#f5a623)
- **Error:** Red (#d64545)
- **Info:** Blue (#1e90ff)
- **Default:** Gray

### Form Elements

#### Textarea / Input
```css
background-color: var(--card-bg);
border: 1px solid var(--border-color);
color: var(--text-primary);
padding: 10px 12px;
border-radius: 8px;
font-size: 0.95rem;
transition: all 0.2s ease;
```

**States:**
- **Hover:** Border → `var(--border-light)`, Background → `var(--card-hover-bg)`
- **Focus:** Border → `var(--accent)`, Box-shadow: `0 0 0 3px rgba(16, 163, 127, 0.15)`

#### Checkbox / Radio
- Accent color: `var(--accent)`
- Cursor: pointer

---

## 🎬 Animations & Transitions

### Duration
- **Fast:** 0.15s (for hover states)
- **Normal:** 0.2s (default transitions)
- **Slow:** 0.3s (for complex animations)

### Easing
- **Default:** `ease`
- **Out:** `ease-out` (for entry animations)
- **In-Out:** `ease-in-out` (for complex movements)

### Common Animations

**Button Hover:**
```css
transition: all 0.2s ease;
transform: translateY(-1px);
box-shadow: enhanced;
```

**Card Hover:**
```css
transition: all 0.2s ease;
border-color: var(--accent);
background: var(--card-hover-bg);
```

**Focus Ring:**
```css
outline: none;
border-color: var(--accent);
box-shadow: 0 0 0 3px rgba(16, 163, 127, 0.15);
```

---

## 📱 Responsive Design

### Breakpoints
- **Mobile:** 0 - 767px
- **Tablet:** 768px - 1023px
- **Desktop:** 1024px+

### Mobile Adjustments
- Font sizes: -0.1-0.2rem
- Padding: -4-8px
- Buttons: Stack vertically (`flex-direction: column`)
- Cards: Single column layout
- Sidebars: Fixed overlay with z-index management

---

## 🎯 Layout Patterns

### Full-Width Page
```css
width: 100%;
background-color: var(--bg-primary);
padding: 40px 24px;
```

### Centered Content (Max-Width)
```css
max-width: 900px;
margin: 0 auto;
padding: 40px 32px;
width: 100%;
```

### Hero Section
```css
background: linear-gradient(135deg, var(--bg-primary) 0%, #0a0b11 100%);
padding: 60px 24px;
text-align: center;
border-bottom: 1px solid var(--border-color);
```

### Feature Grid
```css
display: grid;
grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
gap: 20px;
```

---

## 🌐 Shadows

| Level | Value |
|-------|-------|
| **XS** | `0 1px 2px 0 rgba(0, 0, 0, 0.4)` |
| **SM** | `0 2px 4px 0 rgba(0, 0, 0, 0.5)` |
| **MD** | `0 4px 12px 0 rgba(0, 0, 0, 0.5)` |
| **LG** | `0 10px 20px 0 rgba(0, 0, 0, 0.6)` |

### Usage
- **SM:** Cards, dropdowns, small elements
- **MD:** Buttons on hover, larger cards
- **LG:** Modals, overlays, emphasis

---

## 📋 Component Checklist

### Navigation
- [x] Header with logo, nav links, actions
- [x] Mobile hamburger menu
- [x] Active state styling
- [x] Sidebar with session history
- [x] Sidebar toggle on mobile

### Forms
- [x] Input fields (text, email, password, number)
- [x] Textarea with char counter
- [x] Radio buttons (decision options)
- [x] Form validation states
- [x] Error message styling

### Cards & Content
- [x] Decision cards with options
- [x] Feature cards on landing page
- [x] Stats cards
- [x] History items in sidebar
- [x] Badge variants (success, warning, error, info)

### Actions
- [x] Primary buttons (CTAs)
- [x] Secondary buttons (alternatives)
- [x] Tertiary buttons (links)
- [x] Danger buttons (destructive)
- [x] Loading states with spinner

### Feedback
- [x] Success messages with checkmarks
- [x] Error messages with styling
- [x] Warning alerts
- [x] Info badges
- [x] Loading spinners

---

## 🚀 Implementation Tips

### DO ✅
- Use CSS variables for all colors
- Apply gradients for accent colors
- Add smooth transitions to interactive elements
- Test focus states for accessibility
- Use semantic HTML elements
- Follow the spacing system strictly
- Include subtle shadows for depth

### DON'T ❌
- Hardcode colors (use variables)
- Mix color systems (blend teal + blue)
- Use sharp corners (minimum 8px border-radius)
- Skip transitions (minimum 0.2s)
- Ignore focus states
- Use justify-content without align-items
- Apply shadows without purpose

---

## 🔍 Quality Checklist

Before shipping changes:

- [ ] All links are properly colored
- [ ] Buttons have hover states
- [ ] Forms have focus rings
- [ ] Cards have proper shadows
- [ ] Text contrast meets WCAG AA
- [ ] Spacing follows 4px grid
- [ ] Border radius is 8px or 12px
- [ ] Animations are smooth (60fps)
- [ ] Mobile layout is responsive
- [ ] Dark mode consistency is maintained
- [ ] Gradients render smoothly
- [ ] Shadows are subtle, not harsh

---

## 📚 Design Resources

- **Inspiration:** OpenAI ChatGPT interface
- **Color Reference:** Teal accent scheme
- **Typography:** System fonts (SF Pro Display, Segoe UI)
- **Iconography:** Emoji (temporary; replace with SVG icons)

---

## ✨ Future Enhancements

1. **SVG Icons** — Replace emoji icons with custom SVG icons
2. **Light Mode** — Add optional light theme toggle
3. **Animations** — Add page transition animations
4. **Accessibility** — Enhance keyboard navigation
5. **Components Library** — Document reusable component patterns

---

**Design System Version:** 1.0  
**Last Updated:** 2026-07-03  
**Status:** 🎉 Complete & Live
