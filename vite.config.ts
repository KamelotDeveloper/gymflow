import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Known es-toolkit/compat modules used by Recharts — we inline them
// to avoid Rolldown minification hoisting issues.
const INLINE_SHIMS: Record<string, string> = {
  'get': `const e="[object Null]",t="[object Undefined]",n=Object.prototype.toString,r=Object.hasOwn||Object.prototype.hasOwnProperty,i=(e=>e!=null),o=(e=>e===null),s=(e=>e!==void 0),c=(e=>n.call(e)===t),a=(e=>n.call(e)===e),l=(e=>!a(e)&&i(e)&&typeof e==="object"),u=e=>{if(typeof e==="string")return e;if(Array.isArray(e))return e.map(u).join(".");if(typeof e==="symbol")return e;if(e==null)return"";return String(e)},d=e=>{if(Array.isArray(e))return e;let t=u(e);return t?t.split(/[.[\\]]/).filter(Boolean):[]};export default function get(e,t,n){if(e==null)return n;let r=d(t);for(let i=0;i<r.length;i++){if(e==null||typeof e!=="object")return n;let o=r[i];if(!(o in e))return n;e=e[o]}return e===void 0?n:e}`,
  'range': `export default function range(e,t,n){const r=[];if(n===void 0)n=e<0?-1:1;if(t===void 0)t=e,e=0;const i=Math.abs(n),o=Math.floor((t-e)/i);for(let s=0;s<o;s++)r.push(e+n*s);return r}`,
  'sortBy': `export default function sortBy(e,t){const n=[...e];return n.sort((e,n)=>{for(const r of t){const i=typeof r==="function"?r(e):e[r],o=typeof r==="function"?r(n):n[r];if(i<o)return-1;if(i>o)return 1}return 0})}`,
  'omit': `export default function omit(e,t){const n={},r=new Set(t);for(const i of Object.keys(e))if(!r.has(i))n[i]=e[i];return n}`,
  'maxBy': `export default function maxBy(e,t){let n,r=-1/0;for(const i of e){const o=t(i);o>r&&(r=o,n=i)}return n}`,
  'sumBy': `export default function sumBy(e,t){return e.reduce((e,n)=>e+(t(n)||0),0)}`,
  'throttle': `export default function throttle(e,t){let n,r=0;function i(...i){const o=Date.now(),s=o-r;r=o,s>=t?e.apply(this,i):(clearTimeout(n),n=setTimeout(()=>e.apply(this,i),t))}i.cancel=()=>clearTimeout(n);return i}`,
  'minBy': `export default function minBy(e,t){let n,r=1/0;for(const i of e){const o=t(i);o<r&&(r=o,n=i)}return n}`,
  'last': `export default function last(e){return e!=null&&e.length?e[e.length-1]:void 0}`,
  'isPlainObject': `export default function isPlainObject(e){if(e===null||typeof e!=="object")return!1;const t=Object.getPrototypeOf(e);return t===null||t===Object.prototype}`,
  'uniqBy': `export default function uniqBy(e,t){const n=new Map;for(const r of e){const i=typeof t==="function"?t(r):r[t];if(!n.has(i))n.set(i,r)}return[...n.values()]}`,
}

function esToolkitCompatPlugin(): import('vite').Plugin {
  return {
    name: 'es-toolkit-compat',
    enforce: 'pre',
    resolveId(source) {
      const match = source.match(/^es-toolkit\/compat\/(.+)$/)
      if (!match) return null
      const shim = INLINE_SHIMS[match[1]]
      if (!shim) return null
      return '\0es-toolkit-compat:' + match[1]
    },
    load(id) {
      if (!id.startsWith('\0es-toolkit-compat:')) return null
      const modName = id.slice('\0es-toolkit-compat:'.length)
      const shim = INLINE_SHIMS[modName]
      if (!shim) return null
      return shim
    },
  }
}

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    esToolkitCompatPlugin(),
  ],
})
