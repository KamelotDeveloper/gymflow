import sharp from 'sharp'
import { readFileSync, writeFileSync } from 'fs'

const svgIcon = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192">
  <!-- Fondo negro con bordes redondeados -->
  <rect width="192" height="192" rx="36" fill="#111111"/>

  <g transform="translate(96, 96)">
    <!-- ── Barra central ── -->
    <rect x="-42" y="-5" width="84" height="10" rx="5" fill="white"/>

    <!-- ── Lado izquierdo: grande junto a barra → chico afuera ── -->
    <!-- Placa grande (interior, al lado de la barra) -->
    <rect x="-32" y="-26" width="14" height="52" rx="6" fill="white"/>
    <rect x="-31" y="-24" width="10" height="48" rx="4" fill="white" opacity="0.2"/>
    <rect x="-32" y="-26" width="14" height="6" rx="2" fill="white" opacity="0.4"/>
    <!-- Placa mediana -->
    <rect x="-44" y="-18" width="10" height="36" rx="4" fill="white"/>
    <rect x="-43" y="-16" width="7" height="32" rx="3" fill="white" opacity="0.25"/>
    <!-- Collar (tope más chico, más afuera) -->
    <rect x="-54" y="-10" width="8" height="20" rx="3" fill="white"/>

    <!-- ── Lado derecho: grande junto a barra → chico afuera ── -->
    <!-- Placa grande (interior) -->
    <rect x="18" y="-26" width="14" height="52" rx="6" fill="white"/>
    <rect x="21" y="-24" width="10" height="48" rx="4" fill="white" opacity="0.2"/>
    <rect x="18" y="-26" width="14" height="6" rx="2" fill="white" opacity="0.4"/>
    <!-- Placa mediana -->
    <rect x="34" y="-18" width="10" height="36" rx="4" fill="white"/>
    <rect x="36" y="-16" width="7" height="32" rx="3" fill="white" opacity="0.25"/>
    <!-- Collar (tope más chico, más afuera) -->
    <rect x="46" y="-10" width="8" height="20" rx="3" fill="white"/>
  </g>
</svg>`

const svgBuffer = Buffer.from(svgIcon)

await sharp(svgBuffer).resize(192, 192).png().toFile('public/icon-192.png')
await sharp(svgBuffer).resize(512, 512).png().toFile('public/icon-512.png')
console.log('✅ Íconos generados: public/icon-192.png y public/icon-512.png')
