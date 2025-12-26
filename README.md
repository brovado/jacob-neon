# Jacob: Neon Pilgrimage (Interactive Story Prototype) — v2

This version adds **meaningful decisions**:
- persistent run stats: Supplies, Morale, Suspicion, Wounds
- class perks that modify outcomes
- a "who dies" decision hook (Act 2) that can be **choice-driven** *and* **system-driven**
- updated Act 1 team: Super Naturals = Apex, Dedor, Theramous, Widjet

## Run locally
Open `index.html` in your browser.

## Publish on GitHub Pages
Upload to a repo and enable Pages for root.

## Edit content
- `data/classes.json` (class perks + emphasis)
- `data/npcs.json` (NPC roster + tiers)
- `data/panels.json` (story beats + choices + effects)

### Choice effects you can use
```json
"effects": {
  "gift": "dagger",
  "flags": {"met_belander": true},
  "stats": {"supplies": -5, "morale": +3, "suspicion": +2, "wounds": 0},
  "party": {"add": ["npcKey"], "remove": ["npcKey"]},
  "bond": {"npcKey": +1}
}
```
