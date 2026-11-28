import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read=path=>readFile(new URL(path,import.meta.url),'utf8')

test('About and contact panel is available from organization settings',async()=>{
 const app=await read('../src/App.tsx')
 const panel=await read('../src/AboutContactPanel.tsx')
 assert.match(app,/Giới thiệu \/ Liên hệ/)
 assert.match(app,/aboutContactOpen&&<AboutContactPanel/)
 assert.match(panel,/href="tel:0912500396"/)
 assert.match(panel,/href="mailto:tuanluongpham@gmail\.com"/)
 assert.match(panel,/aria-modal="true"/)
 assert.match(panel,/BAOTRI Mini/)
})
test('About and contact panel has a responsive contact layout',async()=>{
 const css=await read('../src/style.css')
 assert.match(css,/\.about-contact-grid\{display:grid;grid-template-columns:1fr 1fr/)
 assert.match(css,/@media\(max-width:600px\)\{#root \.app-shell \.about-contact-grid\{grid-template-columns:1fr\}/)
})
