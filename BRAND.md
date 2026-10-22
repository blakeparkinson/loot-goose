# Loot Goose brand brief

Status: the icon shipped on 2026-10-20 and the five poses shipped on 2026-10-21. What's left is to rewrite this file as the brand guide, the way Affirming Antelope's `BRAND.md` reads.

Loot Goose is a Prime Menagerie app. It shares its look with Slab Rat: the same cartoon style, the same navy badge, one animal per app.

## Brand idea

Loot Goose turns wherever you are into a scavenger hunt. Pick a place and a theme, walk to real stops, snap each find, and an AI judge rules on whether it counts. Play solo or race friends in co-op.

The goose is the detective of the hunt: smug, nosy, and sure it will spot the thing before you do. The brand should feel mischievous, curious, quick, and competitive in a friendly way. It is a goose, not a duckling and not a pirate.

## The icon

`assets/icon.png` is the goose peering through a gold magnifying glass, its eye magnified and one brow raised, on a navy badge. It was generated in Figma from this brief (file "Loot Goose icon concepts") and picked over a coin, a treasure map and a map pin, because the magnifying glass says "hunt" at any size.

| File | What it is |
| --- | --- |
| `assets/icon.png` | 1024 px, no transparency (iOS and the in-app goose) |
| `assets/adaptive-icon-foreground.png` | The badge clipped to a circle inside the Android safe zone, on transparency |
| `assets/splash-icon.png` | The badge at 60% on the badge navy, shown with `contain` |
| `assets/favicon.png` | 48 px |

The icon goose stays where it stands for the app rather than a moment: the Goose Loose button on home, the rank hero on profile and the Generate button on create. Everywhere else the goose is reacting to something, so it uses a pose (below).

The old asset generator (`scripts/generate-assets.mjs`) drew a different, older goose and wrote over `icon.png`; it's gone. The icon set is made from the approved art, not generated in code.

The master lives in the studio repo, `prime-menagerie/brand/goose/`. To change the icon, change the master there and run `npm run brand:sync -- loot-goose <this checkout>`; don't edit these files by hand.

## Character

- **Species.** A domestic white goose (Embden type): long S-curved neck, heavy body, orange bill, orange legs, and a dark eye under a low, expressive brow.
- **Personality.** Smug, nosy, loud, and generous once you've earned it. "HONK" is its catchphrase.
- **Signature prop: the gold magnifying glass.** A pose gets one prop at most: the magnifying glass, a map, or the phone camera. Hats and costumes are optional extras, never part of the base character.
- **Style.** Match the icon and Slab Rat's mood poses:
  - a bold navy outline;
  - soft two-tone cel shading, with white feathers shaded in cool lavender-gray;
  - orange and gold as the only warm colors.
- **Never:** flat clip art, glossy 3D, or photoreal feathers.
- **Silhouette test.** Filled solid black, the pose still reads as a goose. The neck does that work.

## Poses

Shipped 2026-10-21. The masters (1024 px square, on the navy badge) live in the studio repo, `prime-menagerie/brand/goose/poses/`, generated in Figma in the same file and style as the icon. The app's copies are `assets/poses/{honk,found,judging,nope,searching}.png`: 512 px, cut to a circle with the navy badge inside, so screens show them with `borderRadius` at half their size and no background. To change a pose, change the master there and run `npm run brand:sync -- loot-goose <this checkout>`; don't edit these files by hand.

| Pose | What it shows | Where it's used |
| --- | --- | --- |
| HONK | Neck stretched up, bill open | The in-app splash (`GooseSplash`), under the "HONK!" bubble. Success toasts are text-only and don't show it yet. |
| Found it | Holding up the photo of the find, with a green check | The camera's verified result, the hunt complete hero and the goose on the shareable recap card. |
| Judging | Magnifying glass over a photo | The camera's "Checking your photo…" overlay while the AI judge decides. |
| Nope | Wings crossed, head turned away | The camera's rejected result ("Not quite..."). |
| Searching | Peering over a map | The empty states: home ("No hunts yet"), profile ("No completed hunts yet") and the library. No error screen shows a goose yet. |

Use the goose to say something: a result, a nudge, an empty state. Don't place it as decoration.

## Color

The palette is in code: `Brand` in `constants/Colors.ts` holds these values, and the themes build on it (`DarkTheme.gold` is loot gold, `LightTheme.gold` is deep gold, `DarkTheme.bg` is ink). Change a brand color there, not in a screen.

| Token | Value | Use | In code |
| --- | --- | --- | --- |
| Loot gold | `#F5A623` | Primary actions, the magnifying glass, rewards. | `Brand.lootGold`, dark `gold` |
| Deep gold | `#D4880F` | Pressed states, gold on light backgrounds. | `Brand.deepGold`, light `gold` |
| Badge navy | `#0E2047` | The icon field, the splash and the Android icon background. | `Brand.badgeNavy`, the in-app splash; `app.config.js` repeats it for the native splash |
| Goose white | `#FFFDF7` | The bird. A warm white, not blue-white. | `Brand.gooseWhite` |
| Bill orange | `#E8611A` | Bill and legs, in illustration only. Never a UI color. | Not in code, on purpose |
| Ink | `#0D1117` | Dark surfaces and the app background. | `Brand.ink`, dark `bg` |

- The dark surfaces and the functional green (verified) and red (rejected) stay.
- The rest of `constants/Colors.ts` is GitHub's Primer palette. Its blue and purple are not brand colors: keep them out of the art and marketing. Their decorative uses in the UI are now gold tints (`gold` on `goldLight`). Blue and purple remain only where the hue carries meaning: the route line on the scout map (it has to stand out from the map's own yellow and orange roads), the info toast (blue next to green success and red error), and the profile rank tiers (each tier has its own color, gold at the top).
- Deep gold on white is about 2.9:1, below the 4.5:1 that small text needs. In light mode, use it for fills, borders and icons, and keep small text in `text` or `textSecondary`. The `goldText` token does this: loot gold in dark mode, the text colour in light mode.

## Typography

- **Wordmark and big numbers:** pick one chunky, rounded display face, such as Lilita One or Baloo 2 ExtraBold. Set "Loot Goose" in normal case.
- **Body and UI:** stay on the system font.
- **Case:** sentence case for headings and labels. All caps only for "HONK" and short action labels.

## Voice

The goose is a cheeky rival on your side. Lines come from the app today:

- "HONK if you found it."
- "Get out there and find some loot, you beautiful goose."
- "Stealing bread for inspiration..."

Rules:

- Keep lines short, one sentence where possible.
- Tease the player's pace, never their photo or the place they live.
- Use HONK as punctuation, not in every line.
- When the judge rejects a find, the goose says what it was looking for so the player can try again.
- Avoid pirate talk, "epic" or "legendary", and exclamation marks on every line.

## Still to do

1. Swap the goose on primemenagerie.com (`public/apps/loot-goose.png` and the hero poses) and in the menagerie row on yourbuddyblake.com.
2. Rewrite this file as the brand guide.

## Name clearance

We haven't run a trademark search on "Loot Goose". Run a formal search before the store launch or any print run.
