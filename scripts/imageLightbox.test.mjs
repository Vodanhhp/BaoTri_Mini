import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = path => readFile(new URL(path, import.meta.url), 'utf8')

test('equipment thumbnails in editor and detail both open the shared image viewer', async () => {
  const app = await read('../src/App.tsx')
  assert.match(app, /import ImageLightbox from '\.\/ImageLightbox'/)
  assert.match(app, /setImageViewer\(\{images:editing\.images \|\| \[\],index\}\)/)
  assert.match(app, /setImageViewer\(\{images:detailAsset\.images \|\| \[\],index\}\)/)
  assert.match(app, /<ImageLightbox images=\{imageViewer\.images\}/)
})

test('shared image viewer supports keyboard navigation and accessible dialog semantics', async () => {
  const component = await read('../src/ImageLightbox.tsx')
  assert.match(component, /role="dialog" aria-modal="true"/)
  assert.match(component, /event\.key === 'Escape'/)
  assert.match(component, /event\.key === 'ArrowLeft'/)
  assert.match(component, /event\.key === 'ArrowRight'/)
  assert.match(component, /aria-label="Đóng ảnh"/)
})

test('shared lightbox uses bounded viewport sizing and preserves image proportions', async () => {
  const css = await read('../src/style.css')
  assert.match(css, /width:min\(1200px,90vw\);height:min\(820px,85vh\)/)
  assert.match(css, /max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain/)
  assert.match(css, /\.image-lightbox-backdrop\{position:fixed;inset:0;z-index:60/)
})
