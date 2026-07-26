// WCAG contrast audit for the app palette. Run with: node scripts/contrast-audit.mjs
// Flags any text/background pair below AA (4.5:1 normal, 3:1 large text).
//
// Keep this in sync with lib/theme.ts by hand — it re-declares the palettes so
// it has no build dependency on the app.

const light = {
  bg: '#f5ead8', card: '#ebddc5', surface: '#ffffff',
  ink: '#201e1d', sub: '#6d6455', muted: '#766c5a',
  accent: '#a85e2c', btn: '#a85e2c', green: '#6b784f', danger: '#c0504a',
}
const dark = {
  bg: '#1b1916', card: '#2b2620', surface: '#241f19',
  ink: '#f5ead8', sub: '#b3a793', muted: '#a1988a',
  accent: '#d98a52', btn: '#a85e2c', green: '#9aa877', danger: '#dc8079',
}

const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4) }
const lum = (h) => {
  const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16)
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}
const ratio = (a, b) => {
  const l1 = lum(a), l2 = lum(b), hi = Math.max(l1, l2), lo = Math.min(l1, l2)
  return (hi + 0.05) / (lo + 0.05)
}
const grade = (r) => (r >= 4.5 ? 'AA' : r >= 3 ? 'AA-large' : 'FAIL')

let failures = 0
function audit(name, P) {
  console.log(`\n=== ${name} ===`)
  const bgs = ['bg', 'card', 'surface']
  const fgs = ['ink', 'sub', 'muted', 'accent', 'green', 'danger']
  for (const fg of fgs) for (const bg of bgs) {
    const r = ratio(P[fg], P[bg])
    if (r < 3) failures++
    console.log(`${fg.padEnd(7)} on ${bg.padEnd(8)} ${r.toFixed(2).padStart(5)}  ${grade(r)}`)
  }
  const wb = ratio('#ffffff', P.btn)
  if (wb < 4.5) failures++
  console.log(`white   on btn      ${wb.toFixed(2).padStart(5)}  ${grade(wb)}`)
}

audit('LIGHT', light)
audit('DARK', dark)
console.log(`\n${failures ? `⚠️  ${failures} issue(s) below threshold` : '✓ all pairs pass (AA text ≥4.5, large/graphic ≥3, buttons ≥4.5)'}`)
process.exit(failures ? 1 : 0)
