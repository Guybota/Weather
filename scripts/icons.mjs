import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const icon = await readFile(new URL('../public/icon.svg', import.meta.url));
for (const [name, size] of [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['icon-maskable.png', 512],
  ['apple-touch-icon.png', 180],
]) {
  const source =
    name === 'icon-maskable.png'
      ? Buffer.from(icon.toString().replace('rx="112"', 'rx="0"'))
      : icon;
  await sharp(source)
    .resize(size, size)
    .png()
    .toFile(fileURLToPath(new URL(`../public/${name}`, import.meta.url)));
}
console.log('Ícones PWA criados.');
