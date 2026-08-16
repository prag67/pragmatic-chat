import { test, expect } from '@playwright/test';
test('loads v2 app', async ({ page }) => {
  await page.goto('http://localhost:5173/v2/');
  await expect(page.getByText('Pragmatic')).toBeVisible();
});
