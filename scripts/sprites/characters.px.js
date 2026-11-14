// ============================================================
// Лєна й Діма: кадри idle / walk / run / jump (ADR-0239, власник 2026-11-01:
// еталон — його аркуш з дівчиною й хлопцем). Власний малюнок кодом: pxl
// збирає смуги, `compose.mjs` складає з них файли гри.
//
// Клітинка 92×92, стопи стоячи — (46, 76): там само, де в аркушів PixelLab,
// тож падіння й пози лягають на своє місце. Кожен кадр підставляє лише
// позу (`POSES`), дизайн персонажа один на всі кадри. Плаский колір, тінь
// одним-двома кроками, контур — той самий `k`.
// ============================================================
pal({
  k: "#2e1418",                              // контур
  s: "#fcd9bb", S: "#eeaf8c", T: "#c9836a",  // шкіра
  w: "#fbf9f5", W: "#d6d2d4",                // біле
  E: "#2c1a1f", m: "#c9605f", c: "#f5b39c",  // зіниця, рот, рум'янець
  // Лєна
  h: "#a55a38", H: "#7f3f2b", j: "#c97f55", y: "#f2c766",
  b: "#7aa6d2", B: "#5a82b4", d: "#a3c5e4", e: "#7a2f2a",
  // Діма
  a: "#c98448", A: "#a1602f", g: "#e3ad72", i: "#3f77b8",
  v: "#47302e", V: "#33211f", p: "#a98a72", P: "#86694f", o: "#4d3029", O: "#35201b",
})

const CELL = 92, CX = 46, FOOT = 76, TOP = 12
const DIRS = ["down", "left", "right", "up"]

// --- Малювальні примітиви: кожна частина має власний контур `k`. ---
const tube = (c, x0, y0, x1, y1, w, key) => { c.line(x0, y0, x1, y1, "k", w + 2); c.line(x0, y0, x1, y1, key, w) }
function blob(c, pts, key) {
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) c.poly(pts.map((v, i) => v + (i % 2 ? dy : dx)), "k")
  c.poly(pts, key)
}
const egg = (c, cx, cy, rx, ry, key) => { c.ellipse(cx, cy, rx + 1, ry + 1, "k"); c.ellipse(cx, cy, rx, ry, key) }

// --- Пози. Спільне: `up` — підйом тіла над землею, `lean` — нахил уперед. ---
// Нога: `f` — стопа вперед/назад, `l` — підйом стопи. Рука: `r` — кисть уперед/назад, `u` — вгору.
const cyc = (k, n) => (2 * Math.PI * k) / n
function walkPose(k, n, amp, lift, bob, arm, lean, hair) {
  const t = cyc(k, n), f = Math.round(Math.sin(t) * amp), l = Math.round(Math.max(0, Math.cos(t)) * lift), l2 = Math.round(Math.max(0, -Math.cos(t)) * lift)
  return {
    up: Math.round(Math.abs(Math.cos(t)) * bob), lean, hair,
    a: { f, l }, b: { f: -f, l: l2 },
    near: { r: Math.round(-Math.sin(t) * arm), u: 0 }, far: { r: Math.round(Math.sin(t) * arm), u: 0 },
  }
}
const stand = { up: 0, lean: 0, hair: 0, a: { f: 0, l: 0 }, b: { f: 0, l: 0 }, near: { r: 0, u: 0 }, far: { r: 0, u: 0 } }
const POSES = {
  idle: [stand, { ...stand, breath: 1 }, { ...stand, breath: 1 }, stand],
  walk: [0, 1, 2, 3, 4, 5].map((k) => walkPose(k, 6, 6, 3, 1, 4, 0, 1)),
  run: [0, 1, 2, 3, 4, 5].map((k) => ({ ...walkPose(k, 6, 10, 7, 2, 7, 3, 3), bent: true })),
  jump: [
    { ...stand, up: -3, crouch: 3, near: { r: -4, u: 0 }, far: { r: -4, u: 0 } },                               // підготовка
    { ...stand, up: 5, near: { r: 3, u: 12 }, far: { r: 3, u: 12 }, hair: -1 },                                  // відштовхування
    { ...stand, up: 9, a: { f: 2, l: 5 }, b: { f: -3, l: 3 }, near: { r: 4, u: 14 }, far: { r: 2, u: 14 }, hair: -2 }, // зліт
    { ...stand, up: 10, a: { f: 3, l: 6 }, b: { f: -2, l: 6 }, near: { r: 5, u: 8 }, far: { r: 3, u: 8 }, hair: -3 },  // у повітрі
    { ...stand, up: 3, a: { f: 2, l: 1 }, b: { f: -2, l: 0 }, near: { r: 5, u: 5 }, far: { r: 5, u: 5 }, hair: -2 },   // торкається землі
    { ...stand, up: -2, crouch: 2, near: { r: 3, u: 0 }, far: { r: 3, u: 0 } },                                  // гасить удар
  ],
}

// --- Ноги: спільні, різняться одягом. ---
function legFront(c, who, x, leg, y) {
  const girl = who === "girl", foot = FOOT - leg.l
  if (girl) {
    tube(c, x, y, x, foot - 6, 4, "s")
    c.rect(x - 2, foot - 11, 5, 6, "w"); c.vline(x + 2, foot - 11, 6, "W")
    blob(c, [x - 3, foot - 5, x + 3, foot - 5, x + 4, foot, x - 3, foot], "b"); c.hline(x - 2, foot - 5, 5, "d"); c.hline(x - 2, foot - 1, 6, "B")
  } else {
    blob(c, [x - 3, y, x + 3, y, x + 3, foot - 5, x - 3, foot - 5], "p"); c.rect(x + 2, y, 1, foot - 5 - y, "P")
    blob(c, [x - 4, foot - 5, x + 3, foot - 5, x + 4, foot, x - 4, foot], "o"); c.hline(x - 3, foot - 1, 7, "O")
  }
}

function legSide(c, who, hipX, hipY, leg, far) {
  const girl = who === "girl", foot = FOOT - leg.l, fx = hipX + leg.f
  const skin = far ? "S" : "s", trou = far ? "P" : "p"
  if (girl) {
    tube(c, hipX, hipY, fx, foot - 5, 4, skin)
    tube(c, fx + (hipX - fx) * 0.15, foot - 11, fx, foot - 5, 4, far ? "W" : "w")
    blob(c, [fx - 3, foot - 5, fx + 3, foot - 5, fx + 7, foot - 2, fx + 7, foot, fx - 3, foot], far ? "B" : "b"); if (!far) c.hline(fx - 2, foot - 5, 5, "d")
  } else {
    tube(c, hipX, hipY, fx, foot - 5, 5, trou)
    blob(c, [fx - 3, foot - 5, fx + 3, foot - 5, fx + 7, foot - 2, fx + 7, foot, fx - 3, foot], far ? "O" : "o"); c.hline(fx - 2, foot - 1, 9, "O")
  }
}

// Рука: `side` -1 ліворуч, 1 праворуч; кисть від плеча вниз із махом уперед.
function armFront(c, who, side, x, y, arm, bent) {
  const hy = y + 18 - arm.u - (bent ? 4 : 0), hx = x + side * (arm.u > 6 ? 6 : 1), elbow = [x + side * 2, y + 9 - arm.u * 0.4]
  const key = who === "girl" ? "s" : "w"
  tube(c, x, y, ...elbow, 4, key); tube(c, ...elbow, hx, hy, 3, key)
  if (who === "girl") { tube(c, x, y, x + side, y + 4, 5, "w") }
  egg(c, hx, hy + 1, 2, 2, "s")
}
function armSide(c, who, x, y, arm, far, bent) {
  const hx = x + arm.r, hy = y + 18 - arm.u - (bent ? 5 : 0), ex = x + arm.r * 0.3 - (bent ? 3 : 0), ey = y + 9 - arm.u * 0.3
  const key = who === "girl" ? (far ? "S" : "s") : far ? "W" : "w"
  tube(c, x, y, ex, ey, 4, key); tube(c, ex, ey, hx, hy, 3, key)
  if (who === "girl" && !far) tube(c, x, y, x, y + 4, 5, "w")
  egg(c, hx, hy + 1, 2, 2, far ? "S" : "s")
}

// --- Тулуб спереду й ззаду. ---
function bodyFront(c, who, p, y, x, back) {
  if (who === "girl") {
    if (!back) { c.rect(x - 7, y + 26, 14, 4, "w"); c.hline(x - 1, y + 28, 3, "W") }
    blob(c, [x - 7, y + 29, x + 7, y + 29, x + 7, y + 37, x + 12, y + 51, x - 12, y + 51, x - 7, y + 37], "b")
    c.poly([x + 4, y + 30, x + 7, y + 30, x + 7, y + 37, x + 12, y + 51, x + 6, y + 51], "B")
    c.hline(x - 6, y + 37, 13, "B")
    if (!back) { c.vline(x - 6, y + 25, 5, "E"); c.vline(x + 6, y + 25, 5, "E"); c.px(x, y + 27, "E") }
    else { c.vline(x - 4, y + 25, 5, "E"); c.vline(x + 4, y + 25, 5, "E") }
    c.px(x - 6, y + 48, "d"); c.px(x - 4, y + 44, "d")
  } else {
    blob(c, [x - 8, y + 25, x + 8, y + 25, x + 8, y + 44, x - 8, y + 44], "v")
    c.rect(x + 5, y + 26, 3, 18, "V")
    if (!back) {
      c.poly([x - 3, y + 25, x + 3, y + 25, x, y + 33], "w"); c.vline(x, y + 27, 7, "V"); c.px(x, y + 27, "P"); c.px(x, y + 28, "P")
      c.vline(x, y + 34, 10, "V")
    }
    c.hline(x - 8, y + 44, 17, "k")
  }
}

// --- Голова. `tip` — куди дивиться (0 спереду, 1 збоку), `swing` — куди відлітає волосся. ---
function hairBackGirl(c, x, y, swing, side) {
  const s = swing, end = y + 41
  blob(c, [x - 12, y + 9, x + 12, y + 9, x + 13 + s, y + 28, x + 12 + s, end - 2, x + 7 + s, end, x + 4 + s, end - 2, x + 1 + s, end + 1, x - 3 + s, end - 2, x - 7 + s, end, x - 12 + s, end - 3, x - 13 + s, y + 28], "h")
  if (side) { c.line(x - 8 + s, y + 18, x - 8 + s, end - 4, "H"); c.line(x - 3 + s, y + 22, x - 3 + s, end - 4, "H"); c.line(x + 7 + s, y + 22, x + 7 + s, end - 4, "H") }
}
function faceFront(c, who, x, y) {
  const iris = who === "girl" ? "e" : "i"
  for (const ex of [x - 8, x + 4]) {
    c.hline(ex, y + 13, 5, "k"); c.rect(ex, y + 14, 5, 4, "w")
    c.rect(ex + 1, y + 14, 3, 4, iris); c.rect(ex + 2, y + 14, 1, 3, "E"); c.px(ex + 1, y + 14, "w")
  }
  c.rect(x - 9, y + 19, 2, 1, "c"); c.rect(x + 8, y + 19, 2, 1, "c")
  c.hline(x - 1, y + 21, 3, "T"); c.px(x - 2, y + 20, "T"); c.px(x + 2, y + 20, "T")
}
function headFront(c, who, p, x, y) {
  egg(c, x, y + 12, 11, 11, "s")
  c.rect(x - 3, y + 22, 7, 4, "S"); c.hline(x - 3, y + 22, 7, "k"); c.px(x - 4, y + 23, "k"); c.px(x + 4, y + 23, "k")
  c.ellipse(x, y + 12, 11, 11, "s"); c.rect(x + 8, y + 13, 3, 6, "S")
  faceFront(c, who, x, y)
  if (who === "girl") {
    for (const [a, b, k] of [[-12, 12, "h"]]) c.poly([x + a, y + 13, x + a, y + 7, x - 7, y, x + 7, y, x + b, y + 7, x + b, y + 13, x + 8, y + 8, x + 2, y + 9, x + 1, y + 5, x - 3, y + 8, x - 8, y + 9, x - 11, y + 13], k)
    c.vline(x - 12, y + 12, 8, "h"); c.vline(x + 11, y + 12, 8, "H")
    c.hline(x - 6, y + 2, 7, "j"); c.hline(x - 9, y + 4, 4, "j"); c.px(x + 7, y + 3, "H")
    c.px(x - 10, y + 7, "y"); c.px(x - 9, y + 6, "y"); c.px(x - 9, y + 8, "y"); c.px(x + 9, y + 7, "y"); c.px(x + 10, y + 6, "y"); c.px(x + 10, y + 8, "y")
  } else {
    c.poly([x - 12, y + 13, x - 12, y + 6, x - 7, y, x + 7, y, x + 12, y + 6, x + 12, y + 13, x + 9, y + 10, x + 6, y + 12, x + 3, y + 8, x, y + 12, x - 3, y + 8, x - 7, y + 12, x - 10, y + 9], "a")
    c.hline(x - 5, y + 3, 9, "g"); c.hline(x - 8, y + 5, 4, "g"); c.px(x + 4, y + 6, "g"); c.px(x + 8, y + 3, "A"); c.vline(x + 11, y + 7, 4, "A")
  }
}
function headBack(c, who, x, y) {
  if (who === "girl") {
    egg(c, x, y + 12, 12, 12, "h"); c.rect(x - 12, y + 13, 25, 13, "h"); c.hline(x - 6, y + 2, 9, "j"); c.hline(x - 9, y + 4, 4, "j"); c.px(x + 8, y + 4, "H")
    c.line(x - 5, y + 14, x - 6, y + 32, "H"); c.line(x + 1, y + 12, x + 1, y + 34, "H"); c.line(x + 6, y + 14, x + 7, y + 31, "H")
  } else {
    egg(c, x, y + 12, 12, 12, "a"); c.hline(x - 5, y + 3, 9, "g"); c.hline(x - 8, y + 5, 5, "g"); c.rect(x + 7, y + 8, 3, 8, "A")
  }
}
function headSide(c, who, x, y, hairKey) {
  egg(c, x + 1, y + 12, 11, 11, "s")
  c.px(x + 12, y + 16, "k"); c.px(x + 13, y + 15, "k"); c.px(x + 12, y + 15, "s")
  c.rect(x, y + 22, 6, 4, "S")
  const iris = who === "girl" ? "e" : "i"
  c.hline(x + 6, y + 13, 5, "k"); c.rect(x + 7, y + 14, 4, 4, "w"); c.rect(x + 8, y + 14, 3, 4, iris); c.rect(x + 9, y + 14, 1, 3, "E"); c.px(x + 8, y + 14, "w")
  c.rect(x + 4, y + 19, 2, 1, "c"); c.hline(x + 8, y + 21, 3, "T"); c.px(x + 7, y + 20, "T")
  const main = who === "girl" ? "h" : "a", dark = who === "girl" ? "H" : "A", light = who === "girl" ? "j" : "g"
  c.poly([x - 12, y + 16, x - 12, y + 6, x - 7, y, x + 6, y, x + 12, y + 6, x + 12, y + 11, x + 7, y + 8, x + 3, y + 11, x - 1, y + 9, x - 2, y + 20, x - 9, y + 22], main)
  c.rect(x - 3, y + 14, 3, 5, "s"); c.vline(x - 4, y + 14, 5, "k"); c.px(x - 2, y + 16, "S"); c.px(x - 2, y + 17, "S")
  c.hline(x - 6, y + 2, 9, light); c.hline(x - 9, y + 4, 5, light); c.vline(x - 10, y + 8, 7, dark)
  if (who === "girl") { c.px(x - 6, y + 6, "y"); c.px(x - 7, y + 7, "y"); c.px(x - 5, y + 7, "y"); c.px(x - 6, y + 8, "y") }
}

function front(c, who, p, back) {
  const y = TOP - p.up + (p.breath ?? 0), x = CX
  const hipY = FOOT - 14 - (p.crouch ?? 0), lean = 0
  const swing = p.hair >= 0 ? 0 : 0
  const up = p.hair < 0 ? -p.hair : 0
  legFront(c, who, x - 5, p.a, Math.min(y + 45, FOOT - 12))
  legFront(c, who, x + 5, p.b, Math.min(y + 45, FOOT - 12))
  const armL = { u: p.near.u + Math.max(0, p.near.r) }, armR = { u: p.far.u + Math.max(0, p.far.r) }
  if (back) {
    bodyFront(c, who, p, y, x, true)
    armFront(c, who, -1, x - 10, y + 27, armL, p.bent); armFront(c, who, 1, x + 10, y + 27, armR, p.bent)
    if (who === "girl") hairBackGirl(c, x, y - up, swing, false)
    headBack(c, who, x, y)
    return
  }
  if (who === "girl") hairBackGirl(c, x, y - up, swing, true)
  bodyFront(c, who, p, y, x, false)
  armFront(c, who, -1, x - 10, y + 27, armL, p.bent); armFront(c, who, 1, x + 10, y + 27, armR, p.bent)
  headFront(c, who, p, x, y)
}

function side(c, who, p) {
  const y = TOP - p.up + (p.breath ?? 0), x = CX + p.lean - 1, hipX = CX - 1, hipY = Math.min(y + 46, FOOT - 12)
  legSide(c, who, hipX + 1, hipY, p.b, true)
  armSide(c, who, x + 1, y + 28, p.far, true, p.bent)
  if (who === "girl") {
    hairBackGirl(c, x - 5, y - (p.hair < 0 ? -p.hair : 0), p.hair > 0 ? -p.hair : 0, true)
    blob(c, [x - 5, y + 29, x + 6, y + 29, x + 6, y + 37, x + 10, y + 51, x - 9 - p.lean, y + 51, x - 5, y + 37], "b")
    c.poly([x - 9 - p.lean, y + 51, x - 5, y + 38, x - 2, y + 38, x - 3, y + 51], "B"); c.hline(x - 4, y + 37, 10, "B")
    c.rect(x - 4, y + 25, 9, 4, "w"); c.vline(x, y + 25, 5, "E")
  } else {
    blob(c, [x - 6, y + 25, x + 7, y + 25, x + 7, y + 44, x - 6, y + 44], "v"); c.rect(x - 5, y + 26, 3, 18, "V"); c.hline(x - 6, y + 44, 14, "k")
    c.rect(x + 2, y + 25, 4, 3, "w")
  }
  legSide(c, who, hipX, hipY, p.a, false)
  armSide(c, who, x - 1, y + 28, p.near, false, p.bent)
  headSide(c, who, x, y, "h")
}

for (const who of ["girl", "boy"]) for (const [clip, frames] of Object.entries(POSES)) for (const dir of DIRS) {
  anim(`${who}_${clip}_${dir}`, { w: CELL, h: CELL, frames: frames.length, fps: 8, ...(dir === "left" ? { flip: "x" } : {}) }, (c) => {
    const p = frames[c.frame]
    if (dir === "left" || dir === "right") side(c, who, p)
    else front(c, who, p, dir === "up")
  })
}
