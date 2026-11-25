// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Melvin Carvalho
//
// pdf-pane.js — shows a PDF in the SolidOS data browser with the browser's own PDF viewer.
// Applies to a file (not a folder) whose name ends in .pdf, or whose content type the store
// already knows to be application/pdf. Draws a title bar with the file name, its size (from a
// HEAD request with a short Accept) and, for a small file, the page count; Open and Download
// buttons; and the viewer in an iframe. Where the browser has no PDF viewer (most phones), it
// shows the Open link instead. It imports nothing, builds the DOM with createElement/textContent
// (never innerHTML), and writes nothing.
//
// https://solid-panes.github.io/pdf/ · licence: MIT (see LICENSE).

const ACCEPT = 'application/pdf, */*;q=0.1'
const COUNT_LIMIT = 2 * 1024 * 1024 // read files up to this size to count their pages
const STACK = 'system-ui, -apple-system, "Segoe UI", Roboto, Ubuntu, sans-serif'
const ICON = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#c4372d" stroke-width="1.8" stroke-linejoin="round"><path d="M6 2.8h8.2L19 7.6V20a1.2 1.2 0 0 1-1.2 1.2H6A1.2 1.2 0 0 1 4.8 20V4A1.2 1.2 0 0 1 6 2.8z"/><path d="M14 2.8V8h5"/><path d="M8 13h8M8 16.5h5.5" stroke-linecap="round"/></svg>')

const CSS = `
.pdp { box-sizing: border-box; width: 100%; padding: 16px; background: #fff; color: #1f2330; font: 15px/1.45 ${STACK} }
.pdp *, .pdp *::before, .pdp *::after { box-sizing: border-box }
.pdp.pdf-pane { max-width: 1100px; margin: 0 auto }
.pdp-card { border: 1px solid #e5e2df; border-radius: 16px; background: #fff; box-shadow: 0 1px 2px rgba(40, 20, 10, .05), 0 8px 24px rgba(40, 20, 10, .06); overflow: hidden }
.pdp-head { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 14px; padding: 14px 16px 12px }
.pdp-title { flex: 1 1 240px; min-width: 0; display: flex; align-items: flex-start; gap: 12px }
.pdp-badge { flex: 0 0 auto; width: 40px; height: 40px; border-radius: 10px; background: #fdecea; color: #b3261e; display: flex; align-items: center; justify-content: center; font-size: 11.5px; font-weight: 800; letter-spacing: .04em }
.pdp-titletext { min-width: 0 }
.pdp-name { margin: 0; font-size: 18px; line-height: 1.3; font-weight: 700; color: #2a1d17; overflow-wrap: anywhere }
.pdp-meta { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; font-size: 12.5px; font-weight: 600; color: #6b625d }
.pdp-chip { padding: 2px 9px; border-radius: 999px; background: #f4f1ee; white-space: nowrap }
.pdp-actions { display: flex; flex-wrap: wrap; gap: 8px; flex: 0 0 auto }
.pdp .pdp-btn { display: inline-flex; align-items: center; height: 36px; padding: 0 14px; border-radius: 10px; border: 1px solid #ead2cf; background: #fdf6f5; color: #9c2a21; font-weight: 600; font-size: 14px; text-decoration: none; white-space: nowrap }
.pdp .pdp-btn:hover { background: #fbebe9; border-color: #e0b9b4 }
.pdp .pdp-btn:focus-visible { outline: 3px solid #e2897f; outline-offset: 2px }
.pdp .pdp-btn.pdp-primary { background: #c4372d; border-color: #c4372d; color: #fff }
.pdp .pdp-btn.pdp-primary:hover { background: #a92e25 }
.pdp-stage { border-top: 1px solid #eeeae7; background: #f3f2f1 }
.pdp-frame { display: block; width: 100%; height: 80vh; min-height: 420px; border: 0; background: #f3f2f1 }
.pdp-fallback { margin: 0; padding: 40px 16px; text-align: center; color: #4a403b }
.pdp-fallback b { display: block; margin-bottom: 4px; font-size: 16px; color: #2a1d17 }
.pdp-fallback a { color: #9c2a21; font-weight: 600 }
.pdp-note { margin: 0; padding: 9px 16px; border-top: 1px solid #eeeae7; font-size: 12.5px; color: #7a716c }
.pdp-note a { color: #9c2a21 }
@media (max-width: 520px) {
  .pdp { padding: 8px }
  .pdp-head { padding: 12px 12px 10px }
  .pdp-name { font-size: 16.5px }
  .pdp-actions { width: 100% }
  .pdp .pdp-btn { flex: 1 1 0; justify-content: center }
  .pdp-frame { height: 72vh }
}
`

function fileName (uri) {
  let path = uri
  try { path = new URL(uri).pathname } catch (e) {}
  const last = path.split('/').pop() || ''
  try { return decodeURIComponent(last) } catch (e) { return last }
}

// What the store already knows of the content type: a response header the fetcher kept, or a
// type triple from the IANA media-types namespace.
function knownType (subject, store) {
  if (!store) return null
  try {
    const doc = subject.doc ? subject.doc() : subject
    const h = store.fetcher && store.fetcher.getHeader && store.fetcher.getHeader(doc, 'content-type')
    if (h && h.length) return String(h[0])
  } catch (e) {}
  try {
    const types = store.each(subject, store.sym('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'), null, subject.doc ? subject.doc() : undefined)
    for (const t of types) {
      const m = /\/media-types\/([a-z]+\/[^#]+)/i.exec(t.uri || '')
      if (m) return m[1]
    }
  } catch (e) {}
  return null
}

function isPdf (subject, store) {
  const uri = subject && subject.uri
  if (!uri || /\/$/.test(uri.split(/[?#]/)[0])) return false // a folder
  if (/\.pdf$/i.test(fileName(uri))) return true
  return /^\s*application\/pdf\b/i.test(knownType(subject, store) || '')
}

function humanSize (n) {
  if (!(n >= 0)) return null
  if (n < 1024) return n + ' B'
  const units = ['KB', 'MB', 'GB']
  let v = n / 1024; let i = 0
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
  return (v < 10 ? v.toFixed(1) : Math.round(v)) + ' ' + units[i]
}

// Pages, read from the file's own text: the largest /Count of a /Pages node, or failing that the
// number of /Type /Page objects. A file that keeps these in compressed streams gives nothing.
function countPages (bytes) {
  let text = ''
  const step = 0x8000
  for (let i = 0; i < bytes.length; i += step) text += String.fromCharCode.apply(null, bytes.subarray(i, i + step))
  let best = 0
  const pagesRe = /\/Type\s*\/Pages\b[^>]*?\/Count\s+(\d+)|\/Count\s+(\d+)[^>]*?\/Type\s*\/Pages\b/g
  let m
  while ((m = pagesRe.exec(text))) best = Math.max(best, parseInt(m[1] || m[2], 10))
  if (best) return best
  const pages = text.match(/\/Type\s*\/Page(?![a-zA-Z])/g)
  return pages ? pages.length : 0
}

const pane = {
  name: 'pdf',
  icon: ICON,
  label (subject, context) {
    const store = context && context.session && context.session.store
    return isPdf(subject, store) ? 'PDF' : null
  },
  shouldGetFocus (subject) {
    return isPdf(subject, null)
  },
  render (subject, context) {
    const dom = context.dom
    const store = context.session && context.session.store
    const uri = subject.uri
    const win = dom.defaultView || (typeof window !== 'undefined' ? window : null)
    const el = (tag, cls, text) => {
      const e = dom.createElement(tag)
      if (cls) e.className = cls
      if (text != null) e.textContent = text
      return e
    }

    const root = el('div', 'pdp pdf-pane')
    const style = el('style')
    style.textContent = CSS
    root.appendChild(style)

    const name = fileName(uri) || uri
    const card = el('section', 'pdp-card')
    const head = el('div', 'pdp-head')
    const title = el('div', 'pdp-title')
    title.appendChild(el('div', 'pdp-badge', 'PDF'))
    const titleText = el('div', 'pdp-titletext')
    titleText.appendChild(el('h2', 'pdp-name', name))
    const meta = el('div', 'pdp-meta')
    const chip = text => { const c = el('span', 'pdp-chip', text); meta.appendChild(c); return c }
    titleText.appendChild(meta)
    title.appendChild(titleText)

    const link = (text, cls) => {
      const a = el('a', cls, text)
      a.href = uri
      a.rel = 'noopener noreferrer'
      return a
    }
    const actions = el('div', 'pdp-actions')
    const open = link('Open in new tab', 'pdp-btn pdp-primary')
    open.target = '_blank'
    const download = link('Download', 'pdp-btn')
    download.download = name
    actions.append(open, download)
    head.append(title, actions)
    card.appendChild(head)

    const stage = el('div', 'pdp-stage')
    card.appendChild(stage)
    root.appendChild(card)

    function fallback (what, why) {
      const box = el('p', 'pdp-fallback')
      box.appendChild(el('b', null, what))
      if (why) box.append(why + ' ')
      const a = link('Open ' + name)
      a.target = '_blank'
      box.appendChild(a)
      stage.replaceChildren(box)
      if (note.parentNode) note.remove()
    }

    // A note under the viewer: a host may forbid showing its files inside another page, and the
    // page cannot tell, so say where to go if the frame stays empty.
    const note = el('p', 'pdp-note')
    note.append('Nothing showing? Some sites do not let their files open inside another page. ')
    const noteLink = link('Open it in a new tab')
    noteLink.target = '_blank'
    note.appendChild(noteLink)
    note.append('.')

    const nav = win && win.navigator
    if (nav && nav.pdfViewerEnabled === false) {
      fallback('This browser has no built-in PDF viewer.', 'Open it in a new tab or download it.')
    } else {
      const frame = el('iframe', 'pdp-frame')
      frame.title = name
      frame.src = uri
      frame.setAttribute('loading', 'lazy')
      stage.appendChild(frame)
      card.appendChild(note)
    }

    // Size from a HEAD request with a short Accept (a long one needs a CORS preflight, which
    // static hosts refuse). For a small file, read it to count its pages; the viewer then
    // usually gets it from the cache.
    const fetchFn = (store && store.fetcher && store.fetcher._fetch) || (typeof fetch === 'function' ? fetch : null)
    if (fetchFn) {
      Promise.resolve()
        .then(() => fetchFn(uri, { method: 'HEAD', headers: { accept: ACCEPT } }))
        .then(res => {
          if (!res) return
          if ([401, 403, 404, 410].includes(res.status)) {
            chip('HTTP ' + res.status)
            fallback(res.status === 404 || res.status === 410 ? 'This file is not there.' : 'This file is not open to you.', 'The server answered ' + res.status + '.')
            return
          }
          if (!res.ok) return
          const bytes = parseInt(res.headers.get('content-length'), 10)
          const size = humanSize(bytes)
          if (size) chip(size)
          if (bytes > 0 && bytes <= COUNT_LIMIT) {
            return fetchFn(uri, { headers: { accept: ACCEPT } })
              .then(r => r.ok ? r.arrayBuffer() : null)
              .then(buf => {
                const n = buf ? countPages(new Uint8Array(buf)) : 0
                if (n) chip(n === 1 ? '1 page' : n + ' pages')
              })
          }
        })
        .catch(() => {})
    }

    return root
  }
}

export default pane
