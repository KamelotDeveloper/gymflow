import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve, join } from 'path'
import { readFileSync } from 'fs'

/** Convert backslashes to forward slashes for paths in generated JS. */
function normalizePath(p: string): string {
  return p.replace(/\\/g, '/')
}

/**
 * Wraps es-toolkit/compat/* CJS re-exports as proper ESM with correct default exports.
 * 
 * es-toolkit's compat/*.js files do things like:
 *   module.exports = require('../dist/compat/array/sortBy.js').sortBy;
 * 
 * Vite 8's Rolldown can't convert these CJS internal requires properly
 * ("require_isUnsafeProperty is not a function" error in dev).
 * 
 * The .mjs counterparts exist at dist/compat/ subdirectories but they use
 * named exports (export { sortBy }), not default exports. Recharts
 * imports them as default imports (import sortBy from 'es-toolkit/compat/sortBy').
 * 
 * We parse the CJS re-export and generate a thin ESM wrapper that
 * produces the correct default export.
 */
function esToolkitCompatMjsPlugin(): import('vite').Plugin {
  const compatDir = resolve(process.cwd(), 'node_modules', 'es-toolkit', 'compat')
  const prefix = '\0es-toolkit-compat:'

  return {
    name: 'es-toolkit-compat-mjs',
    enforce: 'pre',
    resolveId(source) {
      const match = source.match(/^es-toolkit\/compat\/(.+)$/)
      if (!match) return null
      return prefix + match[1]
    },
    load(id) {
      if (!id.startsWith(prefix)) return null
      const name = id.slice(prefix.length)
      const reexportPath = join(compatDir, `${name}.js`)

      try {
        const content = readFileSync(reexportPath, 'utf-8').trim()

        // Case 1: module.exports = require('...').someProp
        // e.g. "module.exports = require('../dist/compat/array/sortBy.js').sortBy;"
        let m = content.match(
          /module\.exports\s*=\s*require\(['"](.+?)['"]\)\.([a-zA-Z_$][\w$]+);?$/
        )
        if (m) {
          const mjsPath = normalizePath(resolve(compatDir, m[1]).replace(/\.js$/, '.mjs'))
          const exportName = m[2]
          return {
            code: `import { ${exportName} } from '${mjsPath}';
export default ${exportName};`,
            map: null,
          }
        }

        // Case 2: module.exports = require('...')
        // e.g. "module.exports = require('../dist/compat/object/get.js');"
        m = content.match(
          /module\.exports\s*=\s*require\(['"](.+?)['"]\);?$/
        )
        if (m) {
          const mjsPath = normalizePath(resolve(compatDir, m[1]).replace(/\.js$/, '.mjs'))
          return {
            code: `import * as ___mod from '${mjsPath}';
export default ___mod;
export * from '${mjsPath}';`,
            map: null,
          }
        }

        // Case 3: Unknown pattern — fallback to full namespace
        const fallbackMjs = normalizePath(resolve(compatDir, '..', 'dist', 'compat', `${name}.mjs`))
        return {
          code: `import * as ___mod from '${fallbackMjs}';
export default ___mod;`,
          map: null,
        }
      } catch {
        // Fallback: let Vite handle the original CJS
        return null
      }
    },
  }
}

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    esToolkitCompatMjsPlugin(),
  ],
  optimizeDeps: {
    // Exclude recharts so its es-toolkit/compat imports go through our plugin
    exclude: ['recharts'],
    // Pre-bundle use-sync-external-store (CJS transitive dep of recharts)
    include: ['use-sync-external-store'],
  },
})
