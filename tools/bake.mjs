#!/usr/bin/env node
// Bakes the drawn objects (the globe and the money plant) from SVG into AVIF at
// two or three times their display size: small files, crisp on any screen.
// The book covers are not baked: their colour and title are made by the
// page itself, so a new link looks right the moment it is added.
//
// Usage: node tools/bake.mjs   (writes assets/img/*.avif)
import { mkdirSync, statSync } from 'node:fs';
import sharp from 'sharp';
import { earthMap, globeStand } from './art/globe.mjs';
import { plant } from './art/plant.mjs';

mkdirSync('assets/img', { recursive: true });
const jobs = [
  ['earth', earthMap(), { width: 1024, quality: 62 }],
  ['globe-stand', globeStand(), { width: 240, quality: 70 }],
  ['plant', plant(0), { width: 210, quality: 68 }],
];
for (const [name, svg, { width, quality }] of jobs) {
  const out = `assets/img/${name}.avif`;
  await sharp(Buffer.from(svg), { density: 300 }).resize({ width }).avif({ quality, effort: 6 }).toFile(out);
  console.log(`bake: ${out} ${(statSync(out).size / 1024).toFixed(1)} KB`);
}
