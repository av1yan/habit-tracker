// Generates placeholder app assets (icon, Android adaptive icon, splash logo)
// with zero dependencies — a brand-colored checkmark. Run: `node scripts/generate-icons.mjs`
// Replace assets/*.png with real artwork before store submission.

import zlib from 'node:zlib'
import fs from 'node:fs'

const OUT = 'assets'
fs.mkdirSync(OUT, { recursive: true })

// ---- Brand palette ----
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
const ORANGE = hex('#c67139')
const CREAM = hex('#f5ead8')

// ---- Minimal PNG encoder (8-bit RGBA) ----
const CRC = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
const crc32 = (buf) => {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([len, body, crc])
}
const encodePNG = (size, rgba) => {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type: truecolor + alpha
  const stride = size * 4
  const raw = Buffer.alloc((stride + 1) * size)
  for (let y = 0; y < size; y++) rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride)
  const idat = zlib.deflateSync(raw, { level: 9 })
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}

// ---- Draw an anti-aliased checkmark ----
const distSeg = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax
  const dy = by - ay
  const l2 = dx * dx + dy * dy
  let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}
const render = (size, bg, stroke, scale) => {
  const buf = Buffer.alloc(size * size * 4)
  const sc = (p) => [0.5 + (p[0] - 0.5) * scale, 0.5 + (p[1] - 0.5) * scale]
  const A = sc([0.27, 0.53])
  const B = sc([0.44, 0.67])
  const C = sc([0.74, 0.35])
  const half = (0.12 * scale) / 2
  const aa = 1.6 / size
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = (x + 0.5) / size
      const ny = (y + 0.5) / size
      const d = Math.min(distSeg(nx, ny, A[0], A[1], B[0], B[1]), distSeg(nx, ny, B[0], B[1], C[0], C[1]))
      const a = Math.max(0, Math.min(1, 0.5 + (half - d) / aa))
      const i = (y * size + x) * 4
      if (bg) {
        buf[i] = Math.round(stroke[0] * a + bg[0] * (1 - a))
        buf[i + 1] = Math.round(stroke[1] * a + bg[1] * (1 - a))
        buf[i + 2] = Math.round(stroke[2] * a + bg[2] * (1 - a))
        buf[i + 3] = 255
      } else {
        buf[i] = stroke[0]
        buf[i + 1] = stroke[1]
        buf[i + 2] = stroke[2]
        buf[i + 3] = Math.round(a * 255)
      }
    }
  }
  return buf
}

const write = (name, size, bg, stroke, scale) => {
  fs.writeFileSync(`${OUT}/${name}`, encodePNG(size, render(size, bg, stroke, scale)))
  console.log('wrote', `${OUT}/${name}`, `${size}x${size}`)
}

// iOS icon: opaque orange background + cream check (no transparency allowed)
write('icon.png', 1024, ORANGE, CREAM, 1.0)
// Android adaptive foreground: transparent, cream check within the safe zone
write('adaptive-icon.png', 1024, null, CREAM, 0.72)
// Splash logo: transparent, orange check shown on the cream splash background
write('splash-icon.png', 1024, null, ORANGE, 0.42)
