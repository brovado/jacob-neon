# Jacob Neon — Art Direction v3
Production goal: generate unique scene illustrations without committing to unfinished dialogue or unverified player-character likenesses.

## Visual language
Storybook cinematic fantasy with grounded, tactile craft materials. Strong contrast between Act I's warm adventurous wonder, Act II's overwhelming giant-scale grandeur, Act III's exposed survival atmosphere, and Act IV's intimate homecoming. Keep Jacob visibly ordinary relative to professional adventurers.

## Composition
Master chapter illustrations: 16:9, readable at desktop and mobile crops, leave some negative space for UI overlays. Use consistent recurring silhouettes, clothing, tools and palette only after character references are approved. No text, logos, or interface inside generated art.

## First batch (low canon risk)
1. neon_workshop
2. ravine
3. skybridge
4. giant_city
5. teleport_departure (do not establish detailed Super Naturals likenesses yet)
6. broken_crossing
7. return_camp
8. home_workshop

## Pipeline
Art IDs live in data/story/art-catalog.json. Generated assets should be named by ID and saved to the specified path. Mark each asset generated only after the actual file exists. Keep legacy art untouched. A later runtime adapter maps chapter/scene art IDs to files. Before batch generation, lock Jacob's visual character sheet and the global style reference.

## Character fidelity
Super Naturals originated as real player characters; their exact visual design and backstories are UNKNOWN until sourced. Do not fabricate canonical features from repository blurbs.
