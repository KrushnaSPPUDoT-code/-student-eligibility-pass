import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import { fileURLToPath, URL } from 'node:url';

// The Compact runtime pulls in @midnight-ntwrk/onchain-runtime-v3 (via the
// compiled contract), which ships a WASM browser bundle that must be served
// as an ES module. We mirror the official example-bboard (bboard-ui)
// configuration: the wasm plugin rewrites the .wasm import to
// fetch+instantiate, top-level-await keeps the runtime's module-level init
// correct, and the runtime is excluded from pre-bundling so esbuild never
// tries to statically analyze the wasm import.
export default defineConfig({
  resolve: {
    alias: {
      // Browsers ship a native WebSocket; the indexer provider's
      // `isomorphic-ws` default binding is undefined, so map it to a shim.
      'isomorphic-ws': fileURLToPath(new URL('./src/shims/isomorphic-ws.ts', import.meta.url)),
    },
  },
  cacheDir: './.vite',
  plugins: [react(), wasm(), topLevelAwait()],
  build: {
    target: 'esnext',
    minify: false,
    commonjsOptions: {
      transformMixedEsModules: true,
      extensions: ['.js', '.cjs'],
      ignoreDynamicRequires: true,
    },
  },
  optimizeDeps: {
    exclude: ['@midnight-ntwrk/onchain-runtime-v3'],
  },
});