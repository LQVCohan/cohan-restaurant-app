Cards

background: white
border-radius: 1rem (16px)
box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1)
hover: 0 20px 25px -5px rgba(0, 0, 0, 0.1)
transition: box-shadow 0.2s

Form Elements

padding: 0.75rem
border: 1px solid #d1d5db
border-radius: 0.5rem
focus: border-color #0284c7, ring 2px rgba(2, 132, 199, 0.2)

🏗️ Layout Patterns

Container

max-width: 1280px
margin: 0 auto
padding: 0 1rem (mobile), 1.5rem (tablet), 2rem (desktop)

Grid Systems

// 2 columns on mobile, 3 on tablet, 4 on desktop
grid-template-columns: 1fr (mobile)
grid-template-columns: repeat(2, 1fr) (768px+)
grid-template-columns: repeat(3, 1fr) (1024px+)
grid-template-columns: repeat(4, 1fr) (1280px+)

Spacing Scale

XS: 0.25rem (4px)
SM: 0.5rem (8px)
MD: 1rem (16px)
LG: 1.5rem (24px)
XL: 2rem (32px)
2XL: 3rem (48px)
3XL: 4rem (64px)
🎭 Animation & Transitions

Duration
: 0.2s (normal), 0.3s (slow)
Easing
: ease, ease-in-out
Hover Effects
: transform: scale(1.05), translateY(-4px)
Loading
: spin animation for spinners
📱 Responsive Breakpoints

SM: 640px
MD: 768px
LG: 1024px
XL: 1280px
🧩 Component Architecture

File Structure

src/
├── components/
│ ├── ComponentName/
│ │ ├── ComponentName.jsx
│ │ └── ComponentName.scss
├── hooks/
│ └── useHookName.js
├── pages/
│ ├── PageName.jsx
│ └── PageName.scss
├── styles/
│ └── globals.scss
└── data/
└── mockData.js

Component Naming Convention

PascalCase for components:
RestaurantGrid
camelCase for props:
onRestaurantClick
kebab-case for CSS classes:
restaurant-card
BEM methodology:
restaurant-card\_\_header
,
restaurant-card--featured
🎨 Visual Elements

Icons

Emoji-based icons for simplicity: 🍽️ 🍜 🍕 🍔 🍱 🧁 🥤
Consistent size: 1.25rem (20px) for inline, 2.5rem (40px) for large
Shadows

SM: 0 1px 2px rgba(0, 0, 0, 0.05)
MD: 0 4px 6px -1px rgba(0, 0, 0, 0.1)
LG: 0 10px 15px -3px rgba(0, 0, 0, 0.1)
XL: 0 20px 25px -5px rgba(0, 0, 0, 0.1)
Border Radius

SM: 0.25rem (4px)
MD: 0.5rem (8px)
LG: 0.75rem (12px)
XL: 1rem (16px)
Full: 9999px
🔧 Technical Patterns

State Management

useState for local state
Custom hooks for shared logic
Props drilling for simple data flow
Event Handling

Consistent naming:
onActionName
Arrow functions in JSX
Event delegation where appropriate
CSS Methodology

SCSS with BEM naming
CSS Variables for theming
Mobile-first responsive design
Utility classes for common patterns
📋 Component Checklist

When creating new components, ensure:

[ ] Follows file structure convention
[ ] Uses design system colors
[ ] Implements responsive design
[ ] Includes hover/focus states
[ ] Has proper accessibility
[ ] Uses consistent spacing
[ ] Follows naming conventions
[ ] Includes loading/error states

## 🚀 Cách sử dụng Documentation này:

### 1. **Lưu file này vào dự án:**

src/docs/design-system.md

### 2. **Khi bạn cần tôi giúp tạo component mới:**

Copy-paste phần này vào cuộc trò chuyện:

Tôi đang làm việc với FoodHub Design System với:

Primary color: #0284c7 (blue theme)
Font: Inter
Component structure: ComponentName.jsx + ComponentName.scss
BEM naming convention
Mobile-first responsive
Emoji icons
Card-based layouts với rounded corners và shadows
Hãy giúp tôi tạo [tên component] theo design system này.

### 3. **Tạo Quick Reference Card:**

```javascript
// Quick copy-paste cho các cuộc trò chuyện mới
const FOODHUB_DESIGN_TOKENS = {
  colors: {
    primary: "#0284c7",
    primaryHover: "#0369a1",
    primaryLight: "#f0f9ff",
    text: "#0c4a6e",
    gray: "#6b7280",
  },
  spacing: ["0.25rem", "0.5rem", "1rem", "1.5rem", "2rem"],
  borderRadius: "1rem",
  shadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
  font: "Inter",
};
```

Nền
: Xám nhạt (#f1f5f9) với padding 1rem
Card design
: Tất cả sections đều là card trắng với border 2px (#e2e8f0) và border-radius 1rem
Shadow
: Box-shadow đa lớp tạo hiệu ứng nổi
Typography
: Font Inter, màu chủ đạo #0c4a6e (xanh đậm)
Accent color
: #0284c7 (xanh FoodHub)
Hover effects
: Transform translateY và tăng shadow
Spacing
: Margin 1rem giữa các card, padding 1.5rem bên trong
