import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
// HTTPS is required for WebXR on a headset over LAN; HTTP_ONLY=1 disables it (e.g. with adb reverse).
export default defineConfig({ base: './', plugins: process.env.HTTP_ONLY ? [] : [basicSsl()], server: { host: true, port: 5173 }, test: { include: ['tests/**/*.test.ts'] } } as any);
