# Jacob: Neon Pilgrimage (Interactive Story Prototype)

A lightweight, GitHub Pages–ready interactive story engine:
- slideshow "panels" (images optional / placeholders included)
- narration + dialogue bubbles
- "thought" screens (use narration/arc kinds)
- choice screens
- class/profession selection (10 starter classes)
- NPC affinity + relationship tiers
- scene sequencing + slot-filling workflow

## Run locally
Open `index.html` in your browser.

## Publish on GitHub Pages
1. Create a new repo (public or private).
2. Upload the contents of this folder.
3. GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**
4. Select branch `main` and folder `/ (root)`.

## Where to edit content
- `data/classes.json` (class list + emphasis)
- `data/npcs.json` (npc list + affinity + tiered scenes)
- `data/scenes.json` (main story outline + slots)
- `data/panels.json` (panel definitions & script lines)

## Replacing images
Put images into `assets/panels/` and update panel `image` paths in `data/panels.json`.
