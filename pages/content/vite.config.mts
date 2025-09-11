import { resolve } from 'node:path';
import { withPageConfig } from '@extension/vite-config';
import wasm from 'vite-plugin-wasm';

const rootDir = resolve(__dirname);
const srcDir = resolve(rootDir, 'src');

export default withPageConfig({
  resolve: {
    alias: {
      '@src': srcDir,
      buffer: 'buffer',
    },
  },
  publicDir: resolve(rootDir, 'public'),
  plugins: [wasm()],
  build: {
    target: 'es2022',
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      name: 'ContentScript',
      fileName: 'index',
    },
    outDir: resolve(rootDir, '..', '..', 'dist', 'content'),
  },
});
