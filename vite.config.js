import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  // 루트 디렉토리 설정 (프로젝트의 루트)
  root: './',
  // 빌드 결과물이 생성될 디렉토리
  build: {
    target: 'esnext',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.warn', 'console.error', 'console.debug'],
        passes: 2
      },
      mangle: {
        safari10: true
      },
      format: {
        comments: false
      }
    },
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          'ffmpeg-vendor': ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
          'face-api-vendor': ['face-api.js'],
          'd3-vendor': ['d3-scale'],
          'transcription': [
            './js/simple-transcription.js',
            './js/utils/transcription-utils.js',
            './js/utils/audio-utils.js'
          ],
          'face-analysis': [
            './js/face-analysis.js',
            './js/face-detection.js'
          ],
          'error-handling': [
            './js/utils/error-handler.js',
            './js/utils/error-recovery.js',
            './js/utils/error-debug.js'
          ],
          'ui-components': [
            './js/ui-file.js',
            './js/ui-processing.js',
            './js/ui-settings.js',
            './js/ui-theme.js',
            './js/ui-chat.js',
            './js/utils/ui-utils.js'
          ]
        },
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.');
          const extType = info[info.length - 1];
          if (/\.(wasm|bin)$/i.test(assetInfo.name)) {
            return `wasm/[name]-[hash][extname]`;
          }
          if (/\.(png|jpe?g|svg|gif|tiff|bmp|ico)$/i.test(assetInfo.name)) {
            return `images/[name]-[hash][extname]`;
          }
          if (/\.(mp4|webm|ogg|mp3|wav|flac|aac)$/i.test(assetInfo.name)) {
            return `media/[name]-[hash][extname]`;
          }
          if (/\.css$/i.test(assetInfo.name)) {
            return `css/[name]-[hash][extname]`;
          }
          return `assets/[name]-[hash][extname]`;
        },
        chunkFileNames: 'js/[name]-[hash].js',
        entryFileNames: 'js/[name]-[hash].js'
      }
    },
    sourcemap: false,
    reportCompressedSize: false
  },
  // 개발 서버 설정
  server: {
    host: true,
    port: 5173,
    https: true, // HTTPS 활성화
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
    include: ['d3-scale', 'face-api.js']
  },
  assetsInclude: [
    '**/*.bin',
    '**/*.wasm'
  ],
  esbuild: {
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : []
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
  },
  plugins: [
    basicSsl() // HTTPS 플러그인 추가
  ],
  // 정적 파일 제공 설정
  publicDir: 'public',
  // 환경 변수 프리픽스 설정
  envPrefix: 'VITE_',
}); 