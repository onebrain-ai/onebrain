# OneBrain README Diagram Family — Template Notes

The **car-analogy** pair (`car-analogy-{light,dark}.svg`) is the reference implementation.
The remaining 5 diagrams (`bidir-flow`, `harness-os-stack`, `vault-hub`, `coevo-loop`,
`memory-tiers`) copy this grammar mechanically. Everything below is the exact recipe.

Design direction (binding, พี่เก่ง 2026-07-04): **เรียบง่าย + สวยงาม** — simple, elegant,
low-contrast chrome. Color is ONLY an accent (edge bars, chips, connector strokes, icons),
never a full-card flood. No emoji. Only two sanctioned gradients: the brain mark's own
(`ob-brain-grad`, embedded byte-for-byte) and the 1.5px `--grad-button` hairline on the
single `.btn-tech`-framed hero element (§2b) — never a gradient FILL on any body.
OneBrain identity = the embedded **brain mark**, never a recolored box.

---

## 1. Canvas & layout

| Property | Value |
|---|---|
| Large diagrams (`car-analogy`, `harness-os-stack`) | `viewBox="0 0 780 460"`, `width=780 height=460` |
| Small diagrams (`bidir-flow`, `vault-hub`, `coevo-loop`, `memory-tiers`) | keep current widths ~350–460; same viewBox = width/height |
| Root attrs | `role="img" aria-labelledby="ttl desc"` + `<title id="ttl">` + `<desc id="desc">` (full sentence, screen-reader copy) |
| Card padding (x) | 16–22px inner |
| Column gutter (car col → unit) | left col x=40 w=300; right unit x=430 w=310 (≈90px connector gutter) |
| Card gap (vertical stack) | 22px |

## 2. Palette map (light / dark)

Dark is canonical (near-black operator ground). Light = DS re-inks for the white ground.
Values are literal hex (self-contained SVG can't read CSS custom-props / camo blocks them).

| Role | Dark | Light | DS token source |
|---|---|---|---|
| canvas bg + btn-tech inner fill | `#050507` | `#f4f4f7` | `--color-bg` (bg-base) |
| card panel (.cyber-card) | `#08080e` | `#fafafe` | `--color-surface-2` |
| card hairline | `#ffffff0f` | `#08081014` | `--border-subtle` (border2) |
| primary text | `#f0f0f2` | `#0a0a12` | text |
| headline / card-title | `#ffffff` | `#0a0a12` | `--color-white` (re-inks near-black) |
| muted text (card-desc) | `#a1a1aa` | `#52525b` | muted (`--text-secondary`) |
| faint text | `#ffffff9e` | `#0a0a1299` | faint (`--text-tertiary`) |
| ghost (.card-meta) | `#ffffff42` | `#0a0a1259` | ghost (`--text-disabled`) |
| **harness accent** | `#00cce0` | `#007a90` | `--color-harness` (+ its re-ink) |
| grad-button start | `#bc13fe` | `#9500c7` | `--color-accent` (+ re-ink) |
| grad-button end | `#00f3ff` | `#007a90` | `--color-accent-2` (+ re-ink) |

## 2b. Card & frame recipes (owner-verified against components.css)

**`.cyber-card` — ALL panels/blocks** (harness cars, ECU, DRIVER PROFILE here; every
node card in the other 5 diagrams). Source components.css:319-327:

- **SHARP SQUARE rect. NO clip-path, NO corner notches, radius 0.**
- fill `--color-surface-2` · stroke 1px `--border-subtle`
- **2px accent left-edge bar, rendered "on"** (diagrams show the active state; use the
  diagram's section accent). Per `.cyber-card::before` (left/top/bottom −1px, width 2px)
  the bar **overlays the left border exactly** — flush, zero gap, full card height
  including border corners. In SVG the stroke straddles ±0.5px, so the bar rect is
  `x−0.5, y−0.5, width=2, height=h+1` (this covers the left stroke line completely —
  net visual: the card's left edge IS the accent bar; hairline shows top/right/bottom).
- **`.card-meta` slot = TOP-RIGHT**: mono ~7.5px cap, tracking 0.30em, uppercase,
  ghost/`--text-disabled`. The `HARNESS_01` / `PLUG-IN ECU` / `RIDES_WITH_YOU` labels
  live here — NOT as left-side eyebrows.
- card-title: Chakra Petch BoldItalic uppercase in `--color-white` · desc lines: mono in
  muted/faint.

**`.btn-tech` frame — exactly ONE hero element per diagram** (here: the outer ONEBRAIN
UNIT container). `--clip-tech` belongs to this treatment ONLY — never on cards.
Source components.css:34-38, built as two nested paths (the CSS padding trick):

- outer path: `--clip-tech` silhouette — corners cut **12px FIXED** (never percentage),
  top-left + bottom-right (`card_path()` in gen_car.py) — filled `url(#grad-button)`
  (`135deg accent→accent-2`: dark `#bc13fe→#00f3ff`, light re-ink `#9500c7→#007a90`,
  derived from the light accent tokens since tokens.json ships no light gradient.button)
- inner path: same silhouette inset **1.5px** on all sides, same 12px cut, filled
  **bg-base** → net 1.5px gradient hairline frame with matching corners at any size.

Nesting logic: the unit's inner fill is bg-base (same as canvas), so `.cyber-card`
blocks inside it keep their surface-2 contrast exactly as cards on the app canvas.

**Per-subsystem accent (one per diagram — DS §2 "one accent per surface"):**
- harness cars → harness `#00cce0` / `#007a90`
- vault / user-owned data → `--color-vault` `#7c3aed` (dark); light re-ink `#6d28d9`
  (chart-6 light — tokens.json ships no dedicated vault light re-ink)
- co-evolution loop → `--color-loop` `#a8d000` / success-light `#5f7d00`
- memory tiers → pick from the same accent set; keep one accent per diagram
- OneBrain unit/hero → the `.btn-tech` gradient frame + brain mark; never a solid accent fill.

**Semantic exception (owner-approved, car-analogy):** the DRIVER PROFILE card's left bar
uses the **vault violet pair** while everything else in the diagram stays harness cyan —
it signals the block belongs to the USER, not the car. This is the pattern for any
"user-owned data" block inside another subsystem's diagram: same `.cyber-card`, only the
bar color changes. Cards never get halos, brighter borders, or animation to differentiate.

The **brain mark gradient is exempt** from the no-gradient rule — it is the one sanctioned
gradient (`ob-brain-grad` `#ff2d92 → #ff5aa3 → #00f3ff`), embedded byte-for-byte from
`brain.svg`. Never recolor or redraw it (DS §8/§9).

## 3. Text treatment (ALL path-converted)

GitHub camo blocks web fonts, so every glyph is a `<path>`. Generated with fontTools
(`scratchpad/gen_car.py`, pipeline mirrors the vault's `gh-banner-generator.py`).

| Element | Font file | Cap height (px) | Tracking (em) | Fill |
|---|---|---|---|---|
| Section eyebrow (`THE CARS`, `THE BRAIN`) | JetBrains Mono @ wght 420 | 11 | 0.34 | accent / text |
| Sub-eyebrow (`PICK ANY HARNESS`, `RIDES_WITH_YOU`) | JB Mono 420 | 8.5 | 0.30 | ghost |
| `.card-meta` — TOP-RIGHT of card (`HARNESS_01`, `PLUG-IN ECU`, `RIDES_WITH_YOU`) | JB Mono 420, `anchor="end"` at `x+w−12..14`, top `y+12..14` | 7.5 | 0.30 | ghost |
| Card title (`CLAUDE CODE`, `ECU`, `DRIVER PROFILE`) | **Chakra Petch BoldItalic** | 15–22 | 0.02 | white token |
| Body mono (`skills · hooks · behavior`) | JB Mono 420 | 10 | 0.02 | muted |
| Fine mono (`same on every brand`) | JB Mono 420 | 9–9.5 | 0.02 | faint |
| Chip / engine label (`ENGINE // CLAUDE`) | JB Mono 420 | 9 | 0.16 | accent |

Fonts: `~/projects/onebrain-design-system/fonts/` — `ChakraPetch-BoldItalic.ttf`,
`ChakraPetch-MediumItalic.ttf`, `JetBrainsMono-VariableFont_wght.ttf` (instanced to a
weight via `fontTools.varLib.instancer`; 420 ≈ regular, 680 ≈ bold).

**Pipeline (gen_car.py helpers, reuse verbatim):**
- `glyph_paths()` — draws each glyph with `SVGPathPen(gs, ntos=_ntos)`; `_ntos` rounds coords
  to **1 decimal** — this is load-bearing: without rounding the file is ~220KB (fails the
  120KB gate); with it, ~100KB.
- `text_path()` / `T()` — scale to a cap height, place ink top-left at (x, top), support
  `anchor="start|middle|end"`. `T()` emits the final `<path transform="translate(..) scale(..)">`.

Uppercase-mono meta + Chakra italic-uppercase titles = DS §8 voice. **Don't repeat the
title word in its own meta label** (e.g. DRIVER PROFILE block uses `RIDES_WITH_YOU` meta).

### UI-wordmark lockup (DS §8) — the unit header

- **Wordmark text = the pure word `ONEBRAIN` — nothing appended** (DS §8: lockup =
  mark + the word OneBrain). No "UNIT", no suffixes. The wordmark appears exactly
  once per diagram; if a section eyebrow above it would duplicate it, rename the
  eyebrow (car-analogy uses `THE BRAIN` / `RIDES_WITH_YOU`).
- Mark = embedded brain.svg geometry — but **NEVER center its raw 433×466 viewBox**:
  the box has ~107 empty user-units below the drawing, so box-centering floats the
  ink ~11% high (owner-caught bug). **Measured ink bbox = `4.5 0 428 358.5`** (rsvg
  raster, alpha≥16; matches the banner generator's crop `viewBox="4 0 429 359"`).
  Set the nested svg's `viewBox` to this ink bbox and size/center the INK:
  ink height **21.5px at cap 16** (≈1.34× cap; same visual mass as a 28px full box),
  ink width = `ink_h × 428/358.5` ≈ 25.67.
- Ink **vertically centered on the wordmark CAP band** — cap-top..baseline of the
  word only, NOT the word+subline block: `mark_y = wm_top + cap/2 − ink_h/2`.
- **Verify by pixels, not formula**: render, measure mark-ink center vs wordmark-ink
  center in the PNG — must be within ±2px at 1x (car-analogy measured: dark Δ1.50px,
  light Δ1.25px — residual is faint spark halos above the solid body, invisible).
- Deliberate mark→text gap: **12px** at cap 16 (optical, banner-derived), measured
  from the ink right edge (`wm_x = lock_x + ink_w + gap`).
- Wordmark: Chakra Petch BoldItalic, solid `--color-white` (UI wordmark — never the
  gradient; the gradient lives in the mark).
- Subline: mono, **ink-left-aligned to the wordmark's ink-left** (same `x` into `T()`),
  top = `wm_top + cap + 7` (tight rhythm), cap 8.5, faint, tracking 0.14.

## 4. Stroke / radius / spacing constants

| Property | Value | Note |
|---|---|---|
| Card border stroke | `1px` `--border-subtle` | on the square rect |
| Left-edge accent bar | `width=2`, at `x−0.5, y−0.5, h+1` | overlays the left border flush (see §2b) |
| btn-tech frame | 1.5px gradient hairline, 12px fixed cuts TL+BR | hero element only (see §2b) |
| Icon stroke (`.ico`) | `1.75px`, `fill:none`, round caps/joins | Lucide line style, DS §6 (.ob-icon) |
| Plug connector | `1.5px` round cap, `stroke-dasharray: 5 7` on EVERY layer | accent color |
| Radius | **0** everywhere | cards are perfectly square; no notches on cards |
| Icon box | 20–26px, viewBox 24 | `<use href="#i-...">` from embedded sprite |

Icons: embed only the `<symbol>`s you use (from `assets/icons.svg`) into `<defs>`; reference
with `<use href="#i-name" class="ico" stroke="{accent}"/>`. Sprite ids used here: `i-harness`,
`i-skill`, `i-memory`, `i-vault`. Set color per-use via the `stroke` attr (currentColor won't
inherit across a self-contained doc reliably, so pass `stroke=` explicitly).

## 5. Animation (embedded CSS, self-contained, GitHub-safe)

All motion is **infinite loops, no entrance animations** (play-once looks broken in camo
`<img>`). Only `opacity`, `transform`, `stroke-dashoffset`. No JS, no SMIL needed here.
Durations/easings from tokens.json motion scale (reveal 1200ms, outExpo `cubic-bezier(0.16,1,0.3,1)`).

**MOTION RULE (owner, binding): cards NEVER animate. Motion lives ONLY in
connectors (dash-flow) + the brain mark (neuron spark).** No glow pulses on blocks,
no dot pulses, no card highlights — anything box-shaped is static.

| Class | What it does | Timing |
|---|---|---|
| `.plug` (base class) | every connector layer — **carries `stroke-dasharray: 5 7` itself**, so no layer can ever render solid | static |
| `.plug-flow` | dash-flow along plug connectors (cars→ECU) | `plug-flow 1200ms linear infinite` → `dashoffset:-24`. Stagger 3 connectors with `animation-delay: i*400ms` |
| `.sparks` | brain neuron-spark — copied verbatim from `brain.svg` (36 nodes, per-node `--d`/`--dl`) | `ob-spk` / `ob-spkpop`, self-contained, additive only |

(Removed by owner direction 2026-07-05: `.driver-glow` block pulse and `.plug-dot`
opacity pulse — connector node dots are now plain static circles at opacity .9.)

**Motion vocabulary per diagram** (shared grammar under the rule above — motion only on
connectors/paths + the brain mark, never on cards/tiers/layers):
- car-analogy → plug-connector dash-flow + brain spark ✓ (this file)
- bidir-flow → dash-flow both directions Human⇄Agent (connector motion — OK)
- harness-os-stack → dash-flow on the inter-layer arrows (the earlier "glow cascade
  down the 4 layers" idea is dead — it animated cards)
- vault-hub → dash-flow traveling outward along the spokes, staggered (spokes are
  connectors — OK; the hub card itself stays static)
- coevo-loop → dashes travel clockwise around the loop path (OK)
- memory-tiers → dash-flow on the downward connectors between tiers (the earlier
  "tier highlight" idea is dead — it animated cards)

### Reduced-motion (REQUIRED in every file)

```css
@media (prefers-reduced-motion: reduce) {
  .plug-flow, .sparks .spark, .sparks .core { animation: none; }
  .sparks .spark { opacity: .22; }   /* brain freezes to a steady faint glow */
}
```
(`.plug` carries the dasharray, so frozen connectors stay dashed automatically.)

Every animated class must resolve to a **fully legible static state** here (SMIL is NOT
auto-suppressed by the media query — if you ever use SMIL, add an explicit guard).

### Connector rules (hard requirements)

1. **Every connector segment on every layer is dashed** — put `stroke-dasharray` on the
   base `.plug` class, never only on the animated class. A solid-looking segment is a bug.
2. **No two connectors may share/overlap a segment.** Overlapping dashed lines at
   different animation phases interleave and composite into a solid line (this was the
   "solid trunk" bug). Route each connector on its own lane: staggered mid-x verticals
   (368/383/398 here) + distinct entry points on the target edge (154/176/198 here).
3. Layering per connector: faint dashed base (`.plug`, opacity .22, static) + full-opacity
   animated layer (`.plug plug-flow`) on the same path `d`. Under reduced-motion the
   animated layer freezes at dashoffset 0, exactly covering the base dashes.
4. Node dots at both ends (r=3 source / r=2.5 target) — plain STATIC circles,
   opacity .9, no animation class (motion rule: only dash-flow + brain spark).
5. **Standalone browser test is mandatory** (rsvg-convert freezes animations mid-state and
   can mask dash bugs): serve the SVG over localhost, capture two headless-Chrome shots at
   different `--virtual-time-budget` values (e.g. 100 vs 700), pixel-diff the connector
   region — it must differ (dashes moved). See §6.

## 6. Regeneration

```bash
# venv with fonttools lives in the scratchpad (do NOT add fonttools to the repo)
$SCRATCH/venv/bin/python $SCRATCH/gen_car.py
# renders write straight into assets/diagrams/car-analogy-{light,dark}.svg

# verify (all must pass):
python3 -c "import xml.dom.minidom,sys; xml.dom.minidom.parse(sys.argv[1])" <file>   # well-formed
grep -c '<text' <file>            # → 0 (all paths)
grep -nE 'http|@import|url\(' <file>   # → only xmlns + url(#…) internal refs
stat -f%z <file>                  # → < 120000
grep -c 'prefers-reduced-motion' <file>  # → 1

# visual: rsvg-convert -w 1560 <file> -o preview.png   (rsvg ignores reduced-motion; test that
#         path manually or in a browser with the OS setting on)

# standalone animation test (mandatory per-diagram, see §5 connector rules):
cd assets/diagrams && python3 -m http.server 8479 --bind 127.0.0.1 &
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CHROME" --headless=new --disable-gpu --user-data-dir=$SCRATCH/p1 --window-size=780,460 \
  --virtual-time-budget=100 --screenshot=$SCRATCH/t0.png http://127.0.0.1:8479/<file>
"$CHROME" --headless=new --disable-gpu --user-data-dir=$SCRATCH/p2 --window-size=780,460 \
  --virtual-time-budget=700 --screenshot=$SCRATCH/t1.png http://127.0.0.1:8479/<file>
# pixel-diff t0 vs t1 in the connector region (PIL) -> must be > 0 (dashes moved)
```

The `<picture>`/`<img>` embed pattern in the README (dark default + `prefers-color-scheme:light`
source) is retained from the current diagrams — swap the `-dark`/`-light` file per media query.
