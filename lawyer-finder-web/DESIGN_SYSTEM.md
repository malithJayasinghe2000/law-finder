# Lawyer.ai Premium Design System

## Color Palette
- **Primary Gold**: `#ffb84f` (buttons, accents, highlights)
- **Dark Background**: `#0d1017` (hero sections, dark areas)
- **Dark Foreground**: `#0a0d14` (text, main dark color)
- **Light Background**: `#ffffff`, `#fafafa` (cards, sections)
- **Text Colors**: 
  - Dark text: `#0a0d14`
  - Light text: `#ffffff`
  - Muted text: `#a0a4ab`, `#555555`
- **Borders**: `rgba(255, 255, 255, 0.1)` (dark), `neutral-100` (light)

## Typography
- **Font Family**: `Outfit` (sans-serif)
- **Font Weights**: light (300), normal (400), medium (500), semibold (600), bold (700)
- **Headlines**: font-medium or font-bold with 1.05-1.1 line-height
- **Body Text**: font-light to font-normal

## Component Styling

### Buttons
- **Primary**: `bg-[#ffb84f] text-black rounded-full px-6 h-12 font-bold`
- **Secondary**: `bg-white text-black rounded-full px-6 h-12 font-bold border-[#ffb84f]`
- **Outline**: `bg-transparent border-white/20 text-white rounded-full`

### Cards
- **Standard**: `rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-neutral-100`
- **Hover**: `hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] hover:-translate-y-2`
- **Dark Card**: `bg-[#1a1f2e] border border-white/10`

### Input Fields
- **Light Mode**: `bg-neutral-50 border-neutral-200 rounded-xl focus:ring-[#ffb84f]`
- **Dark Mode**: `bg-white/10 border-white/20 rounded-full text-white`

### Sections
- **Hero Dark**: `bg-[#0d1017] text-white py-20`
- **Light Section**: `bg-white py-16`
- **Gray Section**: `bg-[#fafafa] py-24`
- **Feature Dark**: `bg-[#0d1017] py-24`

## Spacing & Layout
- **Container**: `max-w-[1400px] mx-auto px-6 lg:px-12 xl:px-24`
- **Sections**: py-16, py-20, py-24
- **Gaps**: gap-4, gap-6, gap-8
- **Padding**: px-6, py-5, p-8

## Border Radius
- **Buttons**: `rounded-full`
- **Cards**: `rounded-2xl` or `rounded-3xl`
- **Inputs**: `rounded-xl`
- **Small Elements**: `rounded-lg`

## Transitions
- **Default**: `transition-all duration-300`
- **Hover**: `group-hover:scale-105`, `group-hover:-translate-y-2`
- **Color**: `transition-colors`

## Key Pages Implementation Status

### Completed ✅
- [x] Homepage (src/app/[locale]/page.tsx)
- [x] Global Color Scheme (globals.css)
- [x] Lawyer Directory (src/app/[locale]/(public)/lawyers/page.tsx)
- [x] Header/Navigation
- [x] Footer
- [x] Login Page (src/app/[locale]/(auth)/login/page.tsx)

### In Progress 🔄
- [ ] Register Page
- [ ] All Dashboard Pages
- [ ] Admin Panel Pages

### To Do 📋
- [ ] Pricing Page
- [ ] Blog Pages
- [ ] Profile Pages
- [ ] Messages/Chat Pages
- [ ] Consultation Pages
- [ ] Payment Pages
- [ ] All Remaining Pages

## Implementation Guidelines

1. **Dark Sections**: Always use `#0d1017` background with white/light text
2. **Light Sections**: Use white or `#fafafa` with dark text
3. **Primary Accent**: Use `#ffb84f` for buttons, links, and important highlights
4. **Spacing**: Maintain consistent padding and margins using Tailwind scale
5. **Hover States**: Use scale transforms and shadow increases for interactivity
6. **Responsive**: Always use responsive classes (sm:, lg:, xl:)
7. **Typography**: Use light weights for body text, medium-bold for headings

## Testing Checklist
- [ ] Mobile responsive (320px - 480px)
- [ ] Tablet responsive (768px - 1024px)
- [ ] Desktop responsive (1440px+)
- [ ] Dark mode consistency
- [ ] Button hover/active states
- [ ] Form field focus states
- [ ] Navigation on all devices
- [ ] Image loading and optimization
