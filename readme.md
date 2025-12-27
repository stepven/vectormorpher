# Vector Morphing Art Tool

A creative technology tool for creating trippy vector-based animations with morphing effects.

## Features

- Bezier curve path editor (Pen & Select tools)
- Multiple shape creation with parameter controls
- Smooth morphing animations between shapes
- Color interpolation
- Custom animation curve editor
- Full control over iterations, rotation, scale, opacity, and stroke width

## Setup

1. Install dependencies:
```bash
npm install
```

2. Run development server:
```bash
npm run dev
```

3. Build for production:
```bash
npm run build
```

## How to Use

1. **Pen Tool**: Click (or click-hold-drag) to place anchor points with bezier handles
2. **Select Tool**: Drag anchor points or handles to adjust curves
3. Adjust parameters (iterations, rotation, scale, etc.)
4. Save your shape
5. Create 2+ shapes to enable morphing animation
6. Press Play to watch shapes morph!

## Deploy

### Vercel (Recommended)
1. Push to GitHub
2. Import project on vercel.com
3. Deploy!

### Netlify
1. Run `npm run build`
2. Drag `dist` folder to netlify.com

## Tech Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Lucide React (icons)