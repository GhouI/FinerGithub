// Renders public/icon.svg to the PNG sizes needed for installable PWAs (Android, iOS).
// Usage: node scripts/gen-icons.mjs   (uses the Playwright Chromium available in the environment)
import { createRequire } from 'node:module'
const { chromium } = createRequire(import.meta.url)('playwright')
import { readFileSync } from 'node:fs'

const svg = readFileSync(new URL('../public/icon.svg', import.meta.url), 'utf8')
const browser = await chromium.launch()
const page = await browser.newPage()
const targets = [
  ['icon-180.png', 180, false],
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['icon-512-maskable.png', 512, true],
]
for (const [name, size, maskable] of targets) {
  await page.setViewportSize({ width: size, height: size })
  // Maskable icons need a full-bleed background with the glyph in the inner safe zone.
  const inner = maskable ? svg.replace('rx="112"', 'rx="0"').replace('<g ', '<g transform="translate(51 51) scale(0.8)" ') : svg
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${inner}`)
  await page.screenshot({ path: new URL(`../public/${name}`, import.meta.url).pathname, omitBackground: !maskable })
  console.log('wrote', name)
}
await browser.close()
