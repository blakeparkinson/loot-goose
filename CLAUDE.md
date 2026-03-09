# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Loot Goose is a React Native / Expo mobile scavenger hunt app (iOS, Android, Web). Players create or browse AI-generated hunts, find items using camera verification, and can play cooperatively in real-time.

## Development Commands

```bash
npm start              # Start Expo dev server
npm run ios            # Run on iOS simulator
npm run android        # Run on Android emulator
npm run web            # Run on web
npm run generate-assets # Generate app assets with Sharp
```

EAS builds are configured in `eas.json` with development, preview, and production profiles.

## Architecture

**Routing:** Expo Router (file-based) in `app/`. Stack navigation defined in `app/_layout.tsx`.

**State:** Zustand store in `lib/store.ts`, persisted to AsyncStorage. Single `useAppStore` hook.

**Backend:** Supabase Edge Functions for hunt generation, item verification, photo uploads (base64), and hunt publishing. API calls in `lib/api.ts` use fetch with AbortController (40s timeout).

**Key screens:**
- `app/index.tsx` — Hunt list (home)
- `app/create.tsx` — Create new hunt
- `app/hunt/[id].tsx` — Active hunt play screen
- `app/hunt/coop/[code].tsx` — Cooperative multiplayer session
- `app/camera.tsx` — Camera capture for item verification
- `app/library.tsx` — Browse/download published hunts

**Core domain types** are in `lib/types.ts`: Hunt, HuntItem, HuntSource ('generated', 'library', 'challenge', 'goose_loose').

**Supporting modules:**
- `lib/huntInsights.ts` — Route metrics, geocoding confidence scoring
- `lib/geocoding.ts` — Nominatim OSM location lookup
- `lib/weather.ts` — Weather API integration
- `lib/coopClient.ts` — Cooperative session client
- `lib/navigation.ts` — Navigation/routing utilities

## Key Conventions

- TypeScript strict mode; path alias `@/*` maps to project root
- `.npmrc` sets `legacy-peer-deps=true` (required for install)
- Dark theme colors defined in `constants/Colors.ts`
- Environment variables: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `GOOGLE_MAPS_ANDROID_API_KEY`
- Haptics feedback for user interactions
- Animations use react-native-reanimated
