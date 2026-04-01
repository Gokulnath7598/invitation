# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A static wedding invitation website (Gokul & Ramya) featuring a scroll-driven parallax animation. No build system, no dependencies, no package manager.

## Development

Since this is a static site, there are no build commands. To develop locally:

```bash
# Serve with any static file server
python3 -m http.server 8000
# or
npx serve .
```

Then open `http://localhost:8000`.

## Architecture

### File Structure

- `index.html` – Single HTML file with all markup
- `styles.css` – All styles (no preprocessor)
- `script.js` – All JavaScript (vanilla, IIFE, ES5-compatible)
- `assets/` – Images (PNG/JPG), audio (MP3)

### Key Technical Concepts

**Two-Section Scroll Animation**
- Section 1 (Hero): Fixed position layers (mountains, title, temple, flowers) that animate based on scroll progress over 55vh. As user scrolls, temple rises from 50vh to 95vh (30vh to 92vh on mobile), title moves from 32% to 72% top.
- Section 2 (Invitation): Red carpet background with bride/groom images that slide toward center as section enters viewport (`--couple-progress` CSS variable).

**Section 1 Freeze/Unfreeze**
- When section 2 enters viewport and section 1 animation is complete (progress >= 1), section 1 "freezes" to prevent a visual jump. `section1Frozen` flag stores `refTranslateStart`, `refVhAtFreeze`, and `refSection2TopZero`.
- When scrolling back up past section 2, it "unfreezes" and section 1 animates in reverse.
- An "unfreeze band" (scrollY between 0 and `refTranslateStart`) uses lerped translateY for smooth visual transition.

**Mobile Viewport Stability**
- `stableVh` tracks maximum viewport height seen on mobile to prevent layout jumps when address bar shows/hides.
- When frozen, temple height is computed in pixels from `refVhAtFreeze`, not vh units.

**Debug Logging System**
- Debug logs are captured in memory (`debugLines` array, max 600 lines).
- Click "Copy logs" button (top right) to copy to clipboard.
- Version string in `DEBUG_VERSION` helps track which code is running.

### Critical State Variables

- `section1Frozen` – Whether section 1 layers are frozen to viewport
- `refTranslateStart` – Scroll threshold where section 1 starts translating
- `refVhAtFreeze` – Viewport height at freeze time (for stable sizing)
- `refSection2TopZero` – Document Y where section 2 top is at viewport top
- `stableVh` – Maximum vh seen on mobile

### CSS Custom Properties Set by JS

- `--temple-height` – Dynamic temple height (vh or px)
- `--title-top` – Dynamic title position (%, 32 to 72)
- `--couple-progress` – Section 2 couple animation (0 to 1)

### Asset Naming Conventions

- Card corners: `cardCornerBL.png`, `cardCornerBR.png` (BL/BR = bottom-left/bottom-right)
- Couple: `groom.png`, `bride.png`
- Flowers: `rose.png`, `lotus.png`
- Backgrounds: `mountainBG.png`, `redCarpetTexture.jpg`, `ground.jpg`
- Audio: `bgsong.mp3`

### Mobile Breakpoints

- Mobile: < 768px (different temple heights and section 2 layout)
- Small mobile: <= 480px (font size adjustments)

### Browser Support

Code uses ES5 syntax for compatibility. CSS uses modern features (clamp, custom properties) with progressive enhancement in mind.