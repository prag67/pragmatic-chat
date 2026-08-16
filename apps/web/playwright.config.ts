import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  webServer: { command: 'npm run preview -- --port 5173 --host 0.0.0.0', port: 5173 },
});
