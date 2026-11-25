# pdf

A dynamic SolidOS pane that shows PDF documents in the browser's own viewer, read-only.

Loads at runtime by link, with no build or release.

**Try it** in the pane runner or in the SolidOS data browser:

| Sample | Pane runner | SolidOS browser |
|---|---|---|
| Solid panes (3 pages) | [open](https://jss.live/pane-runner/?pane=https%3A%2F%2Fsolid-panes.github.io%2Fpdf%2Fpdf-pane.js&uri=https%3A%2F%2Fsolid-panes.github.io%2Fpdf%2Fsamples%2Fsolid-panes.pdf) | [open](https://solidos.org/docs/browser/?pane=https%3A%2F%2Fsolid-panes.github.io%2Fpdf%2Fpdf-pane.js&uri=https%3A%2F%2Fsolid-panes.github.io%2Fpdf%2Fsamples%2Fsolid-panes.pdf) |

The page asks before it runs a pane from a site it has not seen. Allow it, and the document opens.

## What it does

- Opens files whose name ends in `.pdf`, or whose content type the store already knows is `application/pdf`. It leaves folders alone.
- A title bar with the file name, its size (asked for with a `HEAD` request) and, for files up to 2 MB, the number of pages.
- **Open in new tab** and **Download** buttons.
- The browser's own PDF viewer, in a frame most of the window high.
- Where the browser has no PDF viewer (most phones), it says so and gives the link to open the file instead.
- Reads the file and writes nothing.

## Load it

```js
panes.register((await import('https://solid-panes.github.io/pdf/pdf-pane.js')).default)
```

or `jss start ... --panes https://solid-panes.github.io/pdf/pdf-pane.js`.

## Early days

- Some sites do not let their files be shown inside another page. The page cannot tell when that happens, so a line under the viewer says to open the file in a new tab if the frame stays empty.
- The page count is read from the file itself. Some PDFs keep it in compressed form; then the count is left out.
- The viewer loads the file straight from its address, so a file that needs you to be logged in to your pod may not show yet.

## Licence

[MIT](LICENSE), copyright Melvin Carvalho.

The sample is written for this repository: `tools/sample.html`, printed to `samples/solid-panes.pdf` by `tools/sample-pdf.mjs`. The share card (`og.png`) is rendered by `tools/og.mjs`; the font in `tools/`, Atkinson Hyperlegible, is under the SIL Open Font License.
