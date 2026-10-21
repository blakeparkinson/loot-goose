# Loot Goose brand brief

Status: draft brief for new art, written 2026-10-20. It describes where the brand is going. "What we have today" lists the assets it replaces. Once the new art is approved, rewrite this file as the brand guide, the way Affirming Antelope's `BRAND.md` reads.

Loot Goose is a Prime Menagerie app. Affirming Antelope and Far Fox set the bar for the studio: one character, drawn one way, used on purpose.

## Brand idea

Loot Goose turns wherever you are into a scavenger hunt. Pick a place and a theme, walk to real stops, snap each find, and an AI judge rules on whether it counts. Play solo or race friends in co-op.

The goose is the trickster who already found the loot and dares you to catch up. The brand should feel mischievous, outdoorsy, quick, and competitive in a friendly way. It is a goose, not a duckling and not a pirate.

## What we have today

- **App icon (`assets/icon.png`).** A round white bird with a short orange bill wears an explorer hat and holds a map, with a medal, sparkles and a gold disc behind it.
  - It reads as a duckling: no neck, no attitude.
  - It carries five props, so at home-screen size it blurs.
  - The glossy, gradient style doesn't match the flat, outlined studio art.
  - Its navy field (`#1E2349`) doesn't match the app's launch background (`#0D1117`).
- **The only mascot art.** `GooseSplash` shows the icon. The goose has no poses for empty states, judging, or a finished hunt.
- **`scripts/generate-assets.mjs` draws a different goose.** It's an SVG with a detective hat and a loot bag, and it writes `assets/icon.png`, `adaptive-icon.png`, `splash-icon.png` and `favicon.png`. Running `npm run generate-assets` today would overwrite the shipped icon with that older goose. Retire the script, or point it at the new art, when the new art lands.
- **UI palette (`constants/Colors.ts`).** It's GitHub's Primer palette: `#0D1117`, `#161B22`, `#30363D`, the `#58A6FF` blue and the `#BC8CFF` purple. Only the gold belongs to Loot Goose.
- **Type.** Only the system font, with heavy weights and wide tracking for the hero text. There is no wordmark.

## Character

- **Species.** A domestic white goose (Embden type): long S-curved neck, heavy body, orange bill with a darker knob at the tip, orange legs, and a small dark eye under a low brow that gives it attitude.
- **Personality.** Smug, fast, loud, and generous once you've earned it. "HONK" is its catchphrase.
- **Signature prop: one gold coin.** A pose gets one prop at most: the coin, a map, or the phone camera. Hats and costumes are optional extras, never part of the base character.
- **Style.** Flat color, a thick rounded outline in ink, at most two tones of shading. No gradients, no gloss, no 3D, no photoreal feathers. Match the outline weight of Far Fox's fox and Affirming Antelope's antelope so the goose sits in the Prime Menagerie set.
- **Silhouette test.** Filled solid black, the pose still reads as a goose. The neck does that work.

## App icon

Ask for three concepts and pick one:

1. **Coin grab.** The goose's head and neck in profile, a gold coin clamped in its bill, eye sliding toward the viewer.
2. **HONK.** The head thrown back with the bill wide open and a coin flying out.
3. **Found it.** The head peeking over the edge of the icon with a map pin.

Rules for all three:

- **One idea.** No scenery, sparkles, stars or extra props.
- **Background.** A single flat field. Try the white goose on loot gold (`#F5A623`) first: it stands out among dark icons and owns the app's color. Mock the ink field (`#0D1117`) next to it on a real home screen before choosing.
- **Size test.** It must read at 60 px (the home screen) and 29 px (Settings). Shrink it: can you still tell it's a goose with a coin?
- **Deliverables:**
  - 1024 px master PNG with no transparency (iOS);
  - Android adaptive foreground with the goose inside the central 66% safe zone, plus a background color;
  - 196 px favicon;
  - splash mark;
  - one-color version.

## Poses

Production art: transparent PNG, 1024 px square, same outline and palette as the icon.

| Pose | What it shows | Where it goes |
| --- | --- | --- |
| Default | Standing, wing raised in a wave | Home, onboarding |
| HONK | Neck stretched up, bill open | Splash, success toasts |
| Found it | Coin held up proudly | Item verified, hunt complete |
| Judging | Squinting at a photo held in a wing | The AI judge's loading state |
| Nope | Wings crossed, head turned away | A find the judge rejects |
| Searching | Peering over a map | Empty states, no hunts nearby, errors |

Use the goose to say something: a result, a nudge, an empty state. Don't place it as decoration.

## Color

Gold is the brand. Build everything else around it, not around GitHub's palette.

| Token | Value | Use |
| --- | --- | --- |
| Loot gold | `#F5A623` | Primary actions, coins, the icon field. Existing dark-theme token. |
| Deep gold | `#D4880F` | Pressed states, gold on light backgrounds. Existing light-theme token. |
| Goose white | `#FFFDF7` | The bird. A warm white, not blue-white. |
| Bill orange | `#E8611A` | Bill and legs, in illustration only. Never a UI color, so it doesn't compete with gold or echo Far Fox's orange. |
| Ink | `#0D1117` | Illustration outlines, dark surfaces, the launch background. |

- The dark surfaces and the functional green (verified) and red (rejected) can stay.
- The Primer blue and purple are not brand colors. Keep them out of the art, the icon and marketing, and replace their decorative uses in the UI with gold tints.

## Typography

- **Wordmark and big numbers:** pick one chunky, rounded display face that matches the goose's outline, such as Lilita One or Baloo 2 ExtraBold. Set "Loot Goose" in normal case.
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

## Rollout after approval

1. Replace the icon set in `assets/` and the art in `GooseSplash`, and retire `scripts/generate-assets.mjs`.
2. Add the poses and wire them to the screens in the table.
3. Swap the goose on primemenagerie.com: the medallion in `public/apps/loot-goose.png` and the hero poses.
4. Swap it in the menagerie row on yourbuddyblake.com.
5. Rewrite this file as the brand guide.

## Name clearance

We haven't run a trademark search on "Loot Goose". Run a formal search before the store launch or any print run.
