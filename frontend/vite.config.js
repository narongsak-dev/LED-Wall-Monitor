import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    const backendUrl = env.VITE_API_URL ?? 'http://localhost:3000';
    return {
        plugins: [react()],
        resolve: {
            alias: {
                '@': path.resolve(__dirname, './src'),
                '@monitor/shared': path.resolve(__dirname, '../shared/src/index.ts'),
            },
        },
        server: {
            port: Number(env.FRONTEND_PORT ?? 5173),
            proxy: {
                '/api': {
                    target: backendUrl,
                    changeOrigin: true,
                },
                '/socket.io': {
                    target: backendUrl,
                    changeOrigin: true,
                    ws: true,
                },
            },
        },
        build: {
            outDir: 'dist',
            sourcemap: true,
        },
    };
});
