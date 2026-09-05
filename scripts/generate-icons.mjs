import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const regular = await readFile(new URL('../public/icon.svg', import.meta.url));
const maskable = await readFile(new URL('../public/icon-maskable.svg', import.meta.url));

await Promise.all([
  sharp(regular).resize(192, 192).png().toFile(fileURLToPath(new URL('../public/icon-192.png', import.meta.url))),
  sharp(regular).resize(512, 512).png().toFile(fileURLToPath(new URL('../public/icon-512.png', import.meta.url))),
  sharp(regular).resize(180, 180).png().toFile(fileURLToPath(new URL('../public/apple-touch-icon.png', import.meta.url))),
  sharp(maskable).resize(512, 512).png().toFile(fileURLToPath(new URL('../public/icon-maskable-512.png', import.meta.url)))
]);
