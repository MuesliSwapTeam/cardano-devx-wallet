import { resolve } from 'node:path';
import { withPageConfig } from '@extension/vite-config';
import wasm from 'vite-plugin-wasm';

const rootDir = resolve(__dirname);
const srcDir = resolve(rootDir, 'src');

export default withPageConfig({
  plugins: [wasm()],
  resolve: {
    alias: {
      '@src': srcDir,
      buffer: 'buffer',
    },
  },
  publicDir: resolve(rootDir, 'public'),
  build: {
    target: 'es2022',
    outDir: resolve(rootDir, '..', '..', 'dist', 'popup'),
  },
});
