---
target: Спогади
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:/home/user/Amore/src/features/memories"
timestamp: 2026-10-12T08-40-10Z
slug: src-features-memories
---
Method: dual-agent (A: design review · B: detector). Source-only: live portal unavailable (no VISUAL_USER_* credentials).

Score 27/40 (Acceptable). H1 3, H2 3, H3 1, H4 3, H5 2, H6 3, H7 3, H8 3, H9 3, H10 3.

Specificity: behaviour authored (log spacing, pauses in words, durationLabel, landing line, outward fan); look at phone width close to generic zigzag timeline; no tie to the crystal it now feeds.

Detector: 31 advisory findings, all memories.css; 17 TP (12 off-ramp font sizes 13/15/24/26px, #201b28 untokenised x2, stale --danger fallback, leaf hairline), 14 FP (sanctioned white on media/accent-strong). New code TP: :142, :1169, :1187, :1248.

Priority issues:
- [P1] Thread caption prints whole note (limit 2000), no clamp — MemoryThread.tsx <q>, memories.css .mt-caption q. Breaks distance=time; screen reader reads entire note. Fix: clamp 2 lines. /impeccable harden
- [P1] Back from a memory loses place: Layout.tsx scrolls .content to top; MemoriesPage resets shown to 24. Fix: restore scroll+shown. /impeccable harden
- [P1] Composer: ✕ discards draft without asking (draftChanged unused); saved-photo trash deletes from storage immediately; no history entry for composer/lightbox (Android back leaves page). /impeccable harden
- [P2] Photos too small: s=0.6 col = 86px for most memories, empty fan room when no leaves; frame height noise vs time gaps; rail eats 50px. /impeccable layout
- [P2] Готово disabled silently (ISSUE_HINT unreachable), opacity-disabled violates DESIGN Buttons/Disabled; hint implies photo optional. /impeccable clarify

Minor: untitled memory shows date twice on moment page; dark literals leak into day theme (#201b28, blank stripes); rotated paperclip as close; composer foot padding-right 74px narrows grid; FRAME_CSS_WIDTH stale (140 vs 144 col); new photo can't be cover; neighbours line left vs gallery centred; header "37 · 61 фото" lacks noun.
