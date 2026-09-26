# Design System

## Architecture

**Tailwind CSS v4** with CSS-first configuration:
- `src/styles/tokens.css` - CSS custom properties (design tokens)
- `src/styles/index.css` - `@theme` block for Tailwind + component classes

## Color Tokens

### Text Colors
| Token | Class | Use |
|-------|-------|-----|
| `--color-text-inverse` | `text-inverse` | White text on dark backgrounds |
| `--color-text-inverse-muted` | `text-inverse-muted` | 70% white, secondary text |
| `--color-text-inverse-subtle` | `text-inverse-subtle` | 50% white, tertiary text |

### Border Colors
| Token | Class | Use |
|-------|-------|-----|
| `--color-border-muted` | `border-border-muted` | Gray borders (#6b7280) |
| `--color-border-card` | `border-border-card` | Light card borders (#c8c8c8) |
| `--color-border-inverse` | `border-inverse` | White borders |
| `--color-border-inverse-subtle` | `border-border-inverse-subtle` | 20% white borders |

### Status Colors
| Token | Class | Use |
|-------|-------|-----|
| `--color-success` | `text-success`, `bg-success` | Positive states (#22c55e) |
| `--color-warning` | `text-warning`, `bg-warning` | Alerts, limits (#f59e0b) |
| `--color-danger` | `text-danger`, `bg-danger` | Errors (#ef4444) |
| `--color-info` | `text-info`, `bg-info` | Informational (#3b82f6) |

### Overlay Colors
| Token | Class | Use |
|-------|-------|-----|
| `--color-overlay` | `bg-overlay` | Full page overlays (70%) |
| `--color-overlay-medium` | `bg-overlay-medium` | Modal backdrops (50%) |
| `--color-overlay-light` | `bg-overlay-light` | Subtle backgrounds (20%) |
| `--color-overlay-subtle` | `bg-overlay-subtle` | Hover states (10%) |

### Brand Colors
- `--color-brand-primary`: #5cb800 (Odyssey green)
- `--color-brand-primary-hover`: #4a9600

## Typography

| Class | Font |
|-------|------|
| `font-heading` | Poppins |
| `font-body` | Inter |
| `font-ui` | Genos |

## Component Classes

### Buttons
```jsx
<button className="btn btn-primary">Primary</button>
<button className="btn btn-secondary">Secondary</button>
```

### Form Inputs
```jsx
<input className="form-input" />
<input className="form-input form-input-invalid" /> // Error state
```

### Glass Cards (on dark backgrounds)
```jsx
<div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-border-inverse-subtle">
  <h2 className="text-inverse">Title</h2>
  <p className="text-inverse-muted">Secondary text</p>
</div>
```

## Background Overlays

```jsx
<div className="relative" style={{ backgroundImage: `url(${image})` }}>
  {/* Dark overlay */}
  <div className="absolute inset-0 bg-overlay" />

  {/* Content */}
  <div className="relative z-10">...</div>
</div>
```

## Mobile-First Approach

Base styles are mobile. Use breakpoint prefixes to enhance:
- `sm:` >= 640px
- `md:` >= 768px
- `lg:` >= 1024px

```jsx
// Stack on mobile, row on desktop
<div className="flex flex-col md:flex-row gap-4">

// Hidden on mobile, visible on desktop
<nav className="hidden lg:flex">
```

## Best Practices

1. **Use semantic tokens** - `text-inverse` not `text-white`
2. **Use status colors** - `bg-warning` not `bg-orange-500`
3. **Use overlay tokens** - `bg-overlay-medium` not `bg-black/50`
4. **Mobile-first** - Base styles for mobile, breakpoints for desktop

## File Structure

```
src/styles/
├── tokens.css    # CSS custom properties
└── index.css     # @theme + component classes
```
