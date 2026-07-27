// Generates styled, self-contained HTML for the legal docs so they can be served
// by GitHub Pages. The markdown in legal/ stays the source of truth — run
// `npm run build:legal` after editing it. Output goes to docs/ (GitHub Pages
// "deploy from branch → main → /docs").
//
// Zero dependencies: a tiny Markdown subset converter (headings, bold, lists,
// paragraphs) is all these documents use.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')

function mdToHtml(md) {
  // Drop leading HTML comment block (the TEMPLATE note).
  md = md.replace(/<!--[\s\S]*?-->/g, '').trim()
  const lines = md.split('\n')
  const out = []
  let para = []
  let list = []
  const flushPara = () => {
    if (para.length) out.push(`<p>${inline(para.join(' '))}</p>`)
    para = []
  }
  const flushList = () => {
    if (list.length) out.push(`<ul>${list.map((i) => `<li>${inline(i)}</li>`).join('')}</ul>`)
    list = []
  }
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '')
    if (/^#\s+/.test(line)) {
      flushPara(); flushList(); out.push(`<h1>${inline(line.replace(/^#\s+/, ''))}</h1>`)
    } else if (/^##\s+/.test(line)) {
      flushPara(); flushList(); out.push(`<h2>${inline(line.replace(/^##\s+/, ''))}</h2>`)
    } else if (/^-\s+/.test(line)) {
      flushPara(); list.push(line.replace(/^-\s+/, ''))
    } else if (/^\s+\S/.test(raw) && list.length) {
      list[list.length - 1] += ' ' + line.trim() // continuation of the last list item
    } else if (line.trim() === '') {
      flushPara(); flushList()
    } else {
      flushList(); para.push(line.trim())
    }
  }
  flushPara(); flushList()
  return out.join('\n')
}

function page(title, bodyHtml) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title} · Habit Tracker</title>
<style>
  :root { color-scheme: light dark; }
  body {
    margin: 0; padding: 40px 20px 72px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    line-height: 1.6; color: #2b2620; background: #f5ead8;
  }
  main { max-width: 720px; margin: 0 auto; }
  h1 { font-family: Georgia, "Times New Roman", serif; font-size: 32px; margin: 0 0 4px; }
  h2 { font-family: Georgia, "Times New Roman", serif; font-size: 20px; margin: 32px 0 8px; }
  p, li { font-size: 15px; color: #4a4237; }
  strong { color: #2b2620; }
  ul { padding-left: 22px; }
  li { margin: 4px 0; }
  a { color: #a85e2c; }
  footer { margin-top: 48px; font-size: 12px; color: #8a7f6d; }
  @media (prefers-color-scheme: dark) {
    body { background: #1b1916; color: #e7dcc7; }
    p, li { color: #c3b7a1; }
    strong, h1, h2 { color: #f5ead8; }
    footer { color: #8a8073; }
  }
</style>
</head>
<body>
<main>
${bodyHtml}
<footer>Habit Tracker</footer>
</main>
</body>
</html>
`
}

const docs = [
  { src: 'legal/privacy-policy.md', out: 'docs/privacy.html', title: 'Privacy Policy' },
  { src: 'legal/terms-of-service.md', out: 'docs/terms.html', title: 'Terms of Service' },
]

for (const d of docs) {
  const md = readFileSync(join(root, d.src), 'utf8')
  writeFileSync(join(root, d.out), page(d.title, mdToHtml(md)))
  console.log(`wrote ${d.out}`)
}
