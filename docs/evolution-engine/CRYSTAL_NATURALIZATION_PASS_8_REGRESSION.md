# Crystal Naturalization — Pass 8: the regression run

Pass 10 of the owner's brief, and the last item on the list. Two halves: a
matrix that runs in CI forever, and a one-time sweep of the live portal.

Both found something.

---

## 1. The engine matrix

Five histories × five ages, through the whole pipeline — species, growth,
composition, geometry, material — holding every invariant the six naturalization
passes added. 194 cases.

The histories are shapes real couple data takes, and between them they exercise
every growth dependency landed so far:

| history | what it is | what it tests |
|---|---|---|
| `sparse` | four entries in the whole relationship, one module | the floor: it still has to be a crystal |
| `broad` | every module, steadily | the case the engine is tuned for |
| `bursty` | 200 entries in one weekend, then silence | consistency at its floor, which four mechanisms read |
| `photos` | almost nothing but photos | ADR-0004: photos earn facets and must not also decide girth or fill |
| `gifts` | wishes and plans only | deliberate acts without the volume photos bring |

What it holds, per case: nothing dropped in any diagnostics list; bodies follow
years rather than rows; every published number finite; byte-identical output on
a repeat build; exactly one `focal` body with every other darker than it; no
crown facet below the sliver floor; the striation count equal to the year count;
the zoning amplitude inside its range and off its ceiling; the draw budget.

And, on **one couple observed at five dates** rather than five different
couples: the monarch only grows, a closed year keeps its bearing forever, the
body count never falls, and a facet is never lost to the passage of time.

**That distinction was itself a finding.** The first version compared
`bursty` at one year with `bursty` at three and failed — correctly, for the
wrong reason. Those are two different couples: the burst sits at a different
point in each relationship, so the photos cost different numbers of facets.
ADR-0004's guarantee is about one couple ageing, and testing it needs one fixed
event list with only the observation date moving.

**Validated by breaking it.** Reintroducing the Pass 4 bug — `roleFor` reading
`generation` instead of `tier` — turns 25 of the 194 red, and reverting turns
them green. A regression suite that has never been seen to fail is a suite of
unknown value.

Two guards against passing vacuously, because five of the last six passes found
a mechanism that was green and inert: the coherence test counts how many years
it actually carried forward and requires more than eight, and the crown-facet
test skips nothing.

---

## 2. The live sweep

Thirteen routes × three viewports (360, 412, 1280), checking for horizontal
overflow, content laid out off-screen, unreachable navigation, the route error
boundary, and an empty page.

**`/map` was showing the error boundary at every viewport.** Attributed by
capturing the console: `An API access token is required to use Mapbox GL`.

The cause is a real code defect, not this machine's configuration:

```ts
export const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN ?? 'pk.…';
```

`??` falls back only on `null` and `undefined`. The shape an environment file
takes when a key is present but unset is `VITE_MAPBOX_TOKEN=` — an empty string,
which is neither. So the fallback never applied, Mapbox was handed `''`, it
threw during render, and the boundary caught it: **any deployment with an empty
token in its environment loses the whole map page to a crash screen.** Fixed by
treating empty and whitespace-only as absent, and trimmed as well, because a
stray newline in a deployed variable is truthy and still not a token.

**Two other flags were the probe's fault, not the app's**, and both are worth
recording because the fixed probe is the reusable part:

- `/game` reported an empty page. It is an `iframe` onto a self-contained page,
  so it has no text in the parent document at all. The check now counts
  `iframe`, `canvas`, `svg` and `img` as content.
- `/calendar` reported content off both edges. It is the journey fog —
  `position: absolute`, `left/right: -14%`, `pointer-events: none` — decoration
  that bleeds on purpose and never widens the page. The check now ignores
  anything non-interactive, and anything inside a horizontal scroller.

After both fixes: **39 of 39 route–viewport combinations clean, no console
errors anywhere.**

---

## 3. Where the work stands

Pass 1 listed nine confirmed findings. Six are fixed, and the three that remain
are named honestly in Pass 6's table: two are properties of the architecture
rather than defects, and one — a separate plane builder for the children — is
real work that has not been done.

> The children were done next, in `CRYSTAL_NATURALIZATION_PASS_9_CHILDREN.md`.
> The sweep above earned its keep twice on its first outing: it caught a minor
> face left at a fraction of its size, and a prism band narrowed until the crown
> planes clipped the shoulder corners into degenerate triangles.

The naturalization sequence is complete. What it leaves behind, beyond the
crystal itself, is the procedure: **measure the output distribution, not the
code path, and attribute every measurement by turning the suspect off.** It
found, in order, a clamp eating all seeded variation; a flare too small for the
mechanism built on it; a field derived from the wrong one of two things that
used to agree; a colour ladder mixing a colour with itself; a value step
divided back out by the cap it sat inside; an inclusion applied to the surface
instead of the interior; a derived number saturating its own range; a light
contributing a hundredth of a quantisation step; a navigation bar behind a
canvas; and a token guard that does not catch the empty string.

Not one of those was visible by reading the code, and every one of them was
obvious within minutes of measuring the right thing.
