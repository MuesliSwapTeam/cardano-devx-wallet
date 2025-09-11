import { resolve } from 'node:path';
import { defineConfig, type PluginOption } from "vite";
import libAssetsPlugin from '@laynezh/vite-plugin-lib-assets';
import makeManifestPlugin from './utils/plugins/make-manifest-plugin';
import { watchPublicPlugin, watchRebuildPlugin } from '@extension/hmr';
import { isDev, isProduction, watchOption } from '@extension/vite-config';
import wasm from 'vite-plugin-wasm';

const rootDir = resolve(__dirname);
const srcDir = resolve(rootDir, 'src');

const outDir = resolve(rootDir, '..', 'dist');
export default defineConfig({
  resolve: {
    alias: {
      '@root': rootDir,
      '@src': srcDir,
      '@assets': resolve(srcDir, 'assets'),
    },
  },
  plugins: [
    libAssetsPlugin({
      outputPath: outDir,
    }) as PluginOption,
    watchPublicPlugin(),
    makeManifestPlugin({ outDir }),
    isDev && watchRebuildPlugin({ reload: true }),
    wasm()
  ],
  publicDir: resolve(rootDir, 'public'),
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background/index.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        format: 'es',
      },
      external: ['chrome'],
    },
    outDir,
    emptyOutDir: false,
    sourcemap: isDev,
    minify: isProduction,
    reportCompressedSize: isProduction,
    watch: watchOption,
  },
  envDir: '../',
});
