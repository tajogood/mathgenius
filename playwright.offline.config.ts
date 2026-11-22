import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir:'./tests/offline',
  timeout:40_000,
  expect:{timeout:15_000},
  use:{
    baseURL:'http://127.0.0.1:4173',
    ...devices['Desktop Chrome'],
  },
  projects:[{name:'chromium',use:{browserName:'chromium'}}],
  webServer:{
    command:'npm run preview -- --host 127.0.0.1 --port 4173',
    url:'http://127.0.0.1:4173',
    timeout:30_000,
    reuseExistingServer:!process.env.CI,
  },
});
