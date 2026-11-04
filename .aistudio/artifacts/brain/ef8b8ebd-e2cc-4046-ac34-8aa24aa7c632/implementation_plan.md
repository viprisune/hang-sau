# HANG SÂU — Light, Darkness & Atmosphere (Revised Plan)

This update introduces oppressive cave darkness, finite match lighting with flicker and decay, line-of-sight tile-face surface memory that remains faintly visible through darkness and fog, lightweight vignette and film-grain post overlays, camera sway, procedural Web Audio soundscapes, and a minimal bottom-left HUD while keeping existing map data and movement physics unchanged.

## User Review & Critical Decisions

> [!IMPORTANT]
> All confirmed choices and your 5 required architectural revisions are incorporated below:

- **Confirmed Decision 1 — Line-of-Sight Surface Memory per Tile Face**:
  - Surface memory is stored **per tile face** (floor, ceiling, cardinal wall faces `N/S/E/W`, and chamber props per tile) rather than per vertex.
  - While a match is burning, a 2D tile-grid DDA line-of-sight check verifies whether each candidate tile face within the flame's reach is unobstructed from the player's position. Surfaces on the other side of a wall or around blind corners are never marked.
- **Confirmed Decision 2 — Fog-Exempt Remembered Visibility & Partial Buffer Updates**:
  - Each tile face records its contiguous vertex range `[vertexStart, vertexCount]` when the merged cave mesh is built. When a tile face is newly marked as remembered, **only that slice** of the vertex buffer is updated via `colorAttr.addUpdateRange(...)`, avoiding full-buffer iteration or upload every frame.
  - The cave material extends `MeshStandardMaterial` via `onBeforeCompile` (at `<fog_fragment>`) so remembered faces retain a faint, fog-exempt cold slate luminance floor even beyond the dark fog distance, ensuring remembered geometry remains meaningfully visible at a distance in total darkness.
- **Confirmed Decision 3 — Strict Pause & Hidden-Tab Freeze**:
  - While the `Esc` menu is open or the browser tab is hidden (`document.hidden` / `visibilitychange`), the match burn timer, flicker clock, and procedural audio scheduling (drips, footsteps, wind) pause completely, and frame delta time is strictly clamped (`MAX_DELTA_SEC`).
- **Confirmed Decision 4 — Procedural Audio & Minimal HUD with Vietnamese System Font Fallbacks**:
  - Procedural Web Audio includes ambient cave wind, random water drips, stone footsteps, and match strike/burnout sounds, controlled by Master Volume and Mute in the `Esc` menu.
  - The bottom-left HUD (matches left + thin flame timer bar) and centered Vietnamese notices use comprehensive system font fallbacks (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans", Arial, sans-serif`) so Vietnamese diacritics always render cleanly.

---

## 1. Overview & Core Concept

- **What It Does**: Transforms the 3D cave into a near-total-darkness survival environment (`~0.03` ambient light) where visibility is managed through 5 strikeable matches (`25 s` each), line-of-sight spatial memory of previously illuminated tile faces, and procedural acoustic cues.
- **Target Audience / Persona**: Desktop players seeking an atmospheric, slow-burn low-poly survival horror exploration experience driven by darkness, spatial memory, and sound.
- **Key Value**: Establishes the core survival tension of *HANG SÂU*—striking matches to reveal and permanently memorize line-of-sight cave faces that stay faintly readable through the dark fog after the flame dies.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Entering the Dark Cave**: Clicking the start button initializes the Web Audio context and spawns the player in near-total darkness (`~0.03` ambient intensity, near-black blue-grey fog). A faint `1.5 m` proximity glow around the player prevents the screen from ever becoming 100% black.
  2. **Striking a Match (`F`)**: Pressing `F` consumes 1 of the 5 matches, plays a procedural strike sound, and ignites a warm point light (`#ffb45a`) with a `7.0 m` reach and irregular multi-frequency flicker. Fog density relaxes slightly so nearby low-poly rock facets glow warmly and fall off sharply into darkness.
  3. **Line-of-Sight Tile-Face Memory**: While the match burns, tile faces within the flame's reach that pass a 2D grid line-of-sight raycast from the player are permanently marked as remembered. Their vertex ranges receive a remembered flag, and the shader preserves a faint cold slate-blue visibility for those faces even beyond the dark fog distance.
  4. **Final 5 Seconds & Burnout**: During the last `5 s` of the `25 s` burn duration, the flame reach shrinks smoothly from `7.0 m` down to `3.5 m` before extinguishing with a soft fizzle sound and tightening the fog back to darkness.
  5. **Already-Lit / Empty Match Feedback**: Pressing `F` while a match is already burning does nothing and displays a brief centered Vietnamese notice; pressing `F` with `0` matches left displays an out-of-matches notice.
  6. **Pause & Tab Visibility Freeze (`Esc`)**: Opening the `Esc` menu or switching browser tabs immediately pauses the match burn countdown, flicker clock, and audio scheduling. The `Esc` menu includes **Master Volume** and **Mute** alongside Mouse Sensitivity, FOV (`60°–90°`), and Head-Bob.

- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Oppressive, bleak low-poly survival horror with stark contrast between warm match light, near-black unvisited rock, and faint fog-exempt remembered stone.
  - *Color Palette & Mood*:
    - `--background` / Cave Fog: Near-black blue-grey (`#05070b`)
    - `--primary` / Flame Light & Timer Bar: Warm match amber (`#ffb45a`)
    - `--muted` / Remembered Tile Face Tint: Cold desaturated slate (`#1c2736`, preserved past fog at low intensity)
    - `--foreground` / HUD Typography: Crisp bone-white (`#e2e8f0`) with tabular numerals
  - *Typography & Hierarchy*:
    - Primary UI / HUD Stack: `"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif`
    - Telemetry / Numeric Stack: `"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`
  - *Component Styling & Layout*:
    - Minimal bottom-left HUD showing remaining matches and a thin horizontal flame timer bar.
    - Centered transient Vietnamese status message.
    - Fullscreen lightweight vignette and animated film-grain overlay (`pointer-events-none`).

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Per-Tile-Face Memory Indexing & Partial Buffer Range Updates**
  - *Chosen Approach*: During `buildCaveMesh()`, assign each generated surface (tile floor, tile ceiling, each exposed cardinal wall face `N/S/E/W`, lintel, and chamber prop) a deterministic `faceId` and record its `[vertexStart, vertexCount]` slice. When the line-of-sight solver marks new `faceId` entries, update only those vertex slices in the attribute buffer and register the changed span with `addUpdateRange(offset, count)`.
  - *Why*: Eliminates per-frame full-buffer CPU loops and minimizes GPU buffer uploads to only the newly discovered tile faces on the frame they are first seen.

- **Decision 2: Fog-Exempt Remembered Tint via `onBeforeCompile`**
  - *Chosen Approach*: Encode the remembered state in the vertex color buffer (raising the RGB channels of remembered faces and/or packing a remembered weight) and inject a lightweight 3-line snippet after `#include <fog_fragment>` in `MeshStandardMaterial.onBeforeCompile` that clamps the post-fog output of remembered faces to a faint cold slate floor (`baseColor * REMEMBERED_POST_FOG_FLOOR`).
  - *Why*: Standard Three.js exponential fog (`FogExp2`) multiplies fragment color toward the fog color (`#05070b`) at distance, which would completely erase remembered walls beyond `4–6 m` in darkness. A post-fog floor keeps previously explored chamber walls and corridors faintly readable across the room while keeping `Draw calls: 1`.

- **Decision 3: 2D Grid DDA Line-of-Sight Raycasting in Pure Logic**
  - *Chosen Approach*: In a pure logic module (no Three.js imports), cast 2D grid rays from the player's `(x, z)` to candidate tiles within the flame reach (`currentReach`). A wall face (`N/S/E/W`) is only marked if its normal faces the player (`dot > 0`) and the ray from the player to that face's midpoint does not intersect any intervening solid wall tile.
  - *Why*: Guarantees that walls behind the player's current wall or rooms on the other side of a thin wall are never marked as remembered.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:
```
┌─────────────────────────────────────────────────────────────────────────┐
│                        React Shell & Overlays                           │
│  ┌────────────────────┐  ┌─────────────────────┐  ┌──────────────────┐  │
│  │ Bottom-Left HUD    │  │ Centered Status     │  │ Esc Menu         │  │
│  │ • Matches left     │  │ Notice (Vietnamese) │  │ • Sensitivity    │  │
│  │ • Thin flame bar   │  │ • System font stack │  │ • FOV / Head-bob │  │
│  └─────────▲──────────┘  └──────────▲──────────┘  │ • Volume / Mute  │  │
│            │                        │             └────────┬─────────┘  │
│  ┌─────────┴────────────────────────┴──────────────────────▼─────────┐  │
│  │ Fullscreen Vignette + Film Grain Overlay (pointer-events-none)    │  │
└──┼─────────▲────────────────────────▲──────────────────────┬─────────┼──┘
   │         │                        │                      │         │
   │  ┌──────┴────────────────────────┴──────────────────────▼──────┐  │
   │  │               Pure Game Logic (No Three.js)                 │  │
   │  │  • Match Timer, Flicker & Fog State (pauses on Esc/hidden)  │  │
   │  │  • Tile-Grid DDA Line-of-Sight & Per-Tile-Face Memory Set   │  │
   │  │  • Movement, Wall Collision & Camera Sway / Head-Bob Math   │  │
   │  └──────▲───────────────────────────────────────────────┬──────┘  │
   │         │                                               │         │
   │  ┌──────┴──────────────────────┐ ┌──────────────────────▼──────┐  │
   │  │ Procedural Web Audio Engine │ │ Three.js Cave Renderer      │  │
   │  │ • Wind, Drips, Footsteps    │ │ • 1 PointLight + 0.03 Amb   │  │
   │  │ • Match Strike & Burnout    │ │ • Partial Buffer Range Upd  │  │
   │  │ • Suspends on Pause/Hidden  │ │ • Post-Fog Remembered Tint  │  │
   └──┴─────────────────────────────┴─┴─────────────────────────────┴──┘
```

- **Data Model & State**:
  - `TileFaceDescriptor`: `{ faceId: number; col: number; row: number; cx: number; cz: number; nx: number; nz: number; vertexStart: number; vertexCount: number }` generated deterministically for every visible floor, ceiling, cardinal wall face, and prop.
  - `SurfaceMemoryState`: Pure `Uint8Array` bitset/byte array indexed by `faceId`. `updateVisibleTileFaces()` returns an array of newly discovered `faceId`s on each frame while a match is lit.
  - `MatchLightState`: Pure state tracking `matchesRemaining` (`5`), `isLit`, `burnTimeRemaining` (`25.0 s`), `elapsedFlickerTime`, `currentReach` (`7.0 m -> 3.5 m` in last `5 s`, or `1.5 m` dark glow), `currentIntensity`, and `fogDensity`.

- **Interactive Component & State Mapping**:
  - **Key `F` Press**: Calls `tryStrikeMatch()` in pure logic. If already lit, triggers a `2.0 s` centered Vietnamese notice without resetting the timer or consuming a match. If unlit and `matchesRemaining > 0`, consumes 1 match, starts the `25 s` timer, and plays the procedural strike sound.
  - **Pause & `visibilitychange` Handler**: When `isPaused` becomes `true` or `document.hidden` becomes `true`, the renderer skips advancing `stepMatchLight()`, `stepPlayerMovement()`, and audio drip/footstep timers, suspends the `AudioContext`, and resets `lastTime = performance.now()` upon resume with delta time clamped to `CONFIG.MAX_DELTA_SEC`.
  - **Partial Buffer Upload**: When `updateVisibleTileFaces()` returns newly seen `faceId`s, the renderer updates only `[vertexStart .. vertexStart + vertexCount]` in the `color` (and remembered attribute) `Float32Array` and calls `attribute.addUpdateRange(startOffset, count)` before setting `attribute.needsUpdate = true`.
