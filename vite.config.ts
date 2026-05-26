import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Absolute path to project root (where vite.config.ts lives)
const projectRoot = path.dirname(fileURLToPath(import.meta.url))

function esToolkitCompatPlugin(): import('vite').Plugin {
  // Pre-load mapping from compat module name → dist ESM path + export name
  let mapping: Map<string, { esmPath: string; exportName: string }> | null = null
  function ensureMapping() {
    if (mapping) return
    mapping = new Map()
    const compatDir = path.resolve(projectRoot, 'node_modules/es-toolkit/compat')
    if (!fs.existsSync(compatDir)) return
    for (const file of fs.readdirSync(compatDir)) {
      if (!file.endsWith('.js')) continue
      const content = fs.readFileSync(path.join(compatDir, file), 'utf-8')
      const m = content.match(/require\('\.\.\/dist\/compat\/(.*?)\.js'\)\.(\w+)/)
      if (m) {
        mapping.set(file.replace(/\.js$/, ''), {
          esmPath: path.resolve(projectRoot, 'node_modules/es-toolkit/dist/compat', `${m[1]}.mjs`),
          exportName: m[2],
        })
      }
    }
  }

  return {
    name: 'es-toolkit-compat',
    enforce: 'pre',
    resolveId(source) {
      const match = source.match(/^es-toolkit\/compat\/(.+)$/)
      if (!match) return null
      ensureMapping()
      const info = mapping?.get(match[1])
      if (!info) return null
      return '\0es-toolkit-compat:' + match[1]
    },
    load(id) {
      if (!id.startsWith('\0es-toolkit-compat:')) return null
      const modName = id.slice('\0es-toolkit-compat:'.length)
      ensureMapping()
      const info = mapping?.get(modName)
      if (!info) return null
      // Re-export the named export as default
      return `export { ${info.exportName} as default } from ${JSON.stringify(info.esmPath)}`
    },
  }
}

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    esToolkitCompatPlugin(),
  ],
  optimizeDeps: {
    exclude: ['es-toolkit'],
  },
})
