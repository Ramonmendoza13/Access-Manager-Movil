/**
 * Script para regenerar los iconos de la app móvil a partir del logo SVG de la web.
 * Origen: access-manager-frontend/public/favicon.svg
 * Destino: access-manager-movil/assets/
 *
 * Requisito: npm install --save-dev @resvg/resvg-js (o ejecutar con npx)
 * Ejecución: node scripts/generate-icons.js
 */

const fs = require('fs');
const path = require('path');

let Resvg;
try {
  Resvg = require('@resvg/resvg-js').Resvg;
} catch (e) {
  console.error('Error: se requiere @resvg/resvg-js. Ejecuta: npm install --save-dev @resvg/resvg-js');
  process.exit(1);
}

const assetsDir = path.resolve(__dirname, '../assets');

// 1. Android Adaptive Icon Foreground (512x512, fondo transparente, zona segura 66%)
const S_fg = 9.0;
const fgSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none">
  <defs>
    <linearGradient id="fav-l" x1="3" y1="28" x2="16" y2="2.5" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#0284C7"/>
      <stop offset="100%" stop-color="#38BDF8"/>
    </linearGradient>
    <linearGradient id="fav-r" x1="29" y1="28" x2="16" y2="2.5" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#0369A1"/>
      <stop offset="100%" stop-color="#7DD3FC"/>
    </linearGradient>
    <linearGradient id="fav-b" x1="6" y1="18.5" x2="26" y2="18.5" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#38BDF8"/>
      <stop offset="50%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#38BDF8"/>
    </linearGradient>
  </defs>
  <g transform="translate(256, 256) scale(${S_fg}) translate(-16, -15.25)">
    <path d="M16 2.5L3 28H10.5L16 16.5V2.5Z" fill="url(#fav-l)" />
    <path d="M16 2.5L29 28H21.5L16 16.5V2.5Z" fill="url(#fav-r)" />
    <path d="M7 21L9.8 15.5H22.2L25 21H7Z" fill="url(#fav-b)" />
  </g>
</svg>
`;

// 2. Android Adaptive Icon Background (512x512, degradado sutil acorde a #E6F4FE)
const bgSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none">
  <defs>
    <linearGradient id="bg-grad" x1="0" y1="0" x2="0" y2="512" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#F0F9FF"/>
      <stop offset="100%" stop-color="#E0F2FE"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg-grad)"/>
</svg>
`;

// 3. Android Adaptive Icon Monochrome (432x432, blanco plano sobre transparente, Material You)
const S_mono = 7.5;
const monoSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 432 432" width="432" height="432" fill="none">
  <defs>
    <mask id="beam-gap">
      <rect width="32" height="32" fill="white" />
      <path d="M7 21L9.8 15.5H22.2L25 21H7Z" stroke="black" stroke-width="0.8" stroke-linejoin="round" fill="black" />
    </mask>
  </defs>
  <g transform="translate(216, 216) scale(${S_mono}) translate(-16, -15.25)">
    <g mask="url(#beam-gap)">
      <path d="M16 2.5L3 28H10.5L16 16.5V2.5Z" fill="#FFFFFF" />
      <path d="M16 2.5L29 28H21.5L16 16.5V2.5Z" fill="#FFFFFF" />
    </g>
    <path d="M7 21L9.8 15.5H22.2L25 21H7Z" fill="#FFFFFF" />
  </g>
</svg>
`;

// 4. Icono Universal / iOS / Fallback (1024x1024, opaco con fondo)
const S_icon = 21.5;
const iconSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024" fill="none">
  <defs>
    <linearGradient id="icon-bg" x1="0" y1="0" x2="0" y2="1024" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#F0F9FF"/>
      <stop offset="100%" stop-color="#E0F2FE"/>
    </linearGradient>
    <linearGradient id="fav-l" x1="3" y1="28" x2="16" y2="2.5" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#0284C7"/>
      <stop offset="100%" stop-color="#38BDF8"/>
    </linearGradient>
    <linearGradient id="fav-r" x1="29" y1="28" x2="16" y2="2.5" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#0369A1"/>
      <stop offset="100%" stop-color="#7DD3FC"/>
    </linearGradient>
    <linearGradient id="fav-b" x1="6" y1="18.5" x2="26" y2="18.5" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#38BDF8"/>
      <stop offset="50%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#38BDF8"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#icon-bg)"/>
  <g transform="translate(512, 512) scale(${S_icon}) translate(-16, -15.25)">
    <path d="M16 2.5L3 28H10.5L16 16.5V2.5Z" fill="url(#fav-l)" />
    <path d="M16 2.5L29 28H21.5L16 16.5V2.5Z" fill="url(#fav-r)" />
    <path d="M7 21L9.8 15.5H22.2L25 21H7Z" fill="url(#fav-b)" />
  </g>
</svg>
`;

// 5. Favicon web (48x48)
const S_fav = 1.3;
const favSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48" fill="none">
  <defs>
    <linearGradient id="fav-l" x1="3" y1="28" x2="16" y2="2.5" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#0284C7"/>
      <stop offset="100%" stop-color="#38BDF8"/>
    </linearGradient>
    <linearGradient id="fav-r" x1="29" y1="28" x2="16" y2="2.5" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#0369A1"/>
      <stop offset="100%" stop-color="#7DD3FC"/>
    </linearGradient>
    <linearGradient id="fav-b" x1="6" y1="18.5" x2="26" y2="18.5" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#38BDF8"/>
      <stop offset="50%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#38BDF8"/>
    </linearGradient>
  </defs>
  <g transform="translate(24, 24) scale(${S_fav}) translate(-16, -15.25)">
    <path d="M16 2.5L3 28H10.5L16 16.5V2.5Z" fill="url(#fav-l)" />
    <path d="M16 2.5L29 28H21.5L16 16.5V2.5Z" fill="url(#fav-r)" />
    <path d="M7 21L9.8 15.5H22.2L25 21H7Z" fill="url(#fav-b)" />
  </g>
</svg>
`;

const render = (svgStr, width) => {
  const resvg = new Resvg(svgStr, { fitTo: { mode: 'width', value: width } });
  return resvg.render().asPng();
};

console.log('Generando assets en:', assetsDir);
fs.writeFileSync(path.join(assetsDir, 'android-icon-foreground.png'), render(fgSvg, 512));
fs.writeFileSync(path.join(assetsDir, 'android-icon-background.png'), render(bgSvg, 512));
fs.writeFileSync(path.join(assetsDir, 'android-icon-monochrome.png'), render(monoSvg, 432));
fs.writeFileSync(path.join(assetsDir, 'icon.png'), render(iconSvg, 1024));
fs.writeFileSync(path.join(assetsDir, 'favicon.png'), render(favSvg, 48));
console.log('¡Todos los assets han sido generados exitosamente!');

