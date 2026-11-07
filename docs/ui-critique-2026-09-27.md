---
target: this interface
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:/home/nemetona/NEMETONA-hive/MASTERPLAN/index.html"
target_fingerprint: "sha256:f70df43c1543147aef0dc417f241280e4e7747451a798fa80642165d48a14c76"
target_path: /home/nemetona/NEMETONA-hive/MASTERPLAN/index.html
timestamp: 2026-09-27T17-46-38Z
slug: index-html
---
# MASTERPLAN interface critique

Method: dual-agent (A: design_review; B: detector_review). Target: `index.html`, with Home and Pattern Layouts assessed at desktop and phone widths. Mode: Operate.

## Design health

| # | Heuristic | Score | Key issue |
|---|---|---:|---|
| 1 | Visibility of status | 3 | Best result is clear; invalid layouts can show a misleading count. |
| 2 | Match to real work | 3 | Dimensions and material pieces are concrete; V/H and R1 need interpretation. |
| 3 | Control and freedom | 3 | Undo, redo and collapsible panels work. |
| 4 | Consistency | 3 | Shared tokens and controls; a Home/rail title differs. |
| 5 | Error prevention | 3 | Required steps and validation help; invalid comparison count remains risky. |
| 6 | Recognition | 2 | Home has bare tool names; advanced settings use abbreviations. |
| 7 | Efficiency | 2 | Presets help; mobile settings delay the result. |
| 8 | Minimalism | 3 | Calm calculator surface; duplicate navigation and dense controls. |
| 9 | Error recovery | 2 | Invalid layout reason is not visible in the comparison row. |
| 10 | Help | 3 | Empty state provides a good three-step guide; Home offers little guidance. |
| **Total** | | **27/40** | **Acceptable** |

## Design specificity and impression

The graphite palette, drafting accents, plan-like SVG and material accounting feel authored for construction work. Home is less distinctive: seven equally weighted cards repeat the desktop rail without explaining tasks. The calculator's visual result is the strongest moment, but its mobile placement and invalid-state wording weaken trust.

The source detector returned 9 warnings: layout-transition (6), side-tab (2), dark-glow (1). The SVG stroke-width transition is a false positive; two side-tab warnings identify intentional preset emphasis; the glow was mislocated at index.html:0 and appears to come from the nav tooltip. MASTERPLAN's audit:ui and theme:check passed. Headless browser overlays also flagged very small functional labels; overlays were not shown in a human Codex tab.

## What's working

1. The palette and typography create a restrained engineering instrument feel, and the result diagram connects visible panel placement to material accounting.
2. Pattern Layouts' empty state gives a clear three-step path to the first comparison.
3. The completed desktop view gives the best valid material count, PDF action and plan drawing a clear reading order.

## Priority issues

1. **P1 — Mobile result is buried.** At 390×844, four dimensions and two Manage Presets controls consume the first viewport. Once inputs are ready, Settings is open by default and adds a long control section before Pattern Layouts. Collapse advanced settings on phone until requested, add a visible route to the result, and keep the preview close to required dimensions. Suggested command: `$impeccable layout` or `$impeccable adapt`.
2. **P1 — Invalid layout reads as a cheaper option.** In the 300×600 material / 1390×2200 surface example, LONG-SHORT reports `0 pcs` beside valid 19/20/21 piece comparisons because its default long piece is 2400mm. The header should show `Unavailable` plus the reason, with no numeric purchase count or enabled PDF action. Suggested command: `$impeccable clarify` or `$impeccable harden`.
3. **P2 — Home offers labels instead of decisions.** Seven equal cards mirror the sidebar. Add each tool's short task description from config.js and establish one clear starting point or task grouping. Suggested command: `$impeccable clarify` or `$impeccable distill`.
4. **P2 — Dimension controls require interpretation.** Repeated chevron and checkmark buttons beside each input have accessible names but no persistent visible cue for what they do. Make their action discoverable in a compact text label, inline hint, or first-use affordance. Suggested command: `$impeccable clarify`.
5. **P3 — Functional microtype is too small.** Browser inspection found roughly 9–10px dimension and helper labels in Pattern Layouts. Raise the smallest functional text step while checking desktop and phone density. Suggested command: `$impeccable typeset`.

## Persona red flags

- **First-time builder:** Bare names such as Axial Alignment and Guider provide no outcome cue on Home; V/H and R1 require prior knowledge in Pattern Layouts.
- **Experienced estimator:** Presets and keyboard support help, but `0 pcs` for an impossible layout can corrupt a quick comparison.
- **Phone user:** Completing four required fields leads into a long advanced settings section before the first plan drawing or count.

## Minor observations and questions

Home calls one route `Pipe Wrap Calculator` while the rail says `Pipe Wrap`. The nav's short width transitions are real but lower priority than task clarity. The deterministic scan's glow and side-tab warnings need visual judgment rather than automatic removal.

What should Home help a builder choose first: a named tool or a desired outcome? Should an impossible layout ever display a piece count? Could mobile show the result immediately after the four required dimensions while leaving advanced settings nearby?
