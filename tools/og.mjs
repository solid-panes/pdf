// Renders tools/og.html to og.png (1200 × 630), the picture shown when a link to the site is shared.
// The card in it is drawn by the pane itself, so this serves the repo folder on a local port first.
// It runs Chromium's full headless mode, which has the PDF viewer (the headless shell has none).
//   node tools/og.mjs [path to playwright's index.mjs]   (default: the playwright package)
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join, extname, normalize } from 'node:path'
const { chromium } = await import(process.argv[2] || 'playwright')
const here = (p) => fileURLToPath(new URL(p, import.meta.url))
const root = here('..')
const types = { '.html': 'text/html', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.pdf': 'application/pdf' }
const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '')
  try {
    const body = await readFile(join(root, path))
    res.setHeader('Content-Type', types[extname(path)] || 'application/octet-stream')
    res.setHeader('Accept-Ranges', 'bytes')
    const range = /bytes=(\d+)-(\d*)/.exec(req.headers.range || '') // the video player asks for ranges
    if (range) {
      const start = +range[1]; const end = range[2] ? Math.min(+range[2], body.length - 1) : body.length - 1
      res.statusCode = 206
      res.setHeader('Content-Range', `bytes ${start}-${end}/${body.length}`)
      res.setHeader('Content-Length', end - start + 1)
      return res.end(req.method === 'HEAD' ? undefined : body.subarray(start, end + 1))
    }
    res.setHeader('Content-Length', body.length)
    res.end(req.method === 'HEAD' ? undefined : body)
  } catch { res.statusCode = 404; res.end() }
}).listen(0, '127.0.0.1')
await new Promise(resolve => server.once('listening', resolve))
const browser = await chromium.launch({ channel: 'chromium' })
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
await page.goto(`http://127.0.0.1:${server.address().port}/tools/og.html`)
await page.waitForSelector('iframe.pdp-frame')
await page.waitForFunction(() => [...document.querySelectorAll('.pdp-chip')].length >= 2)
await page.waitForTimeout(2500) // the viewer draws the first page
await page.evaluate(() => document.fonts.ready)
await page.waitForTimeout(300)
await page.screenshot({ path: here('../og.png') })
await browser.close()
server.close()
