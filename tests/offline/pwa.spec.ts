import { test,expect } from '@playwright/test';

test('한 번 방문한 후 네트워크를 끊어도 모든 학년의 수학 교구가 열린다',async({page,context})=>{
  await page.goto('/');
  await expect(page.locator('.brand')).toContainText('수학');
  await page.waitForFunction(()=>!!navigator.serviceWorker?.ready,{timeout:20_000});
  await page.evaluate(async()=>await navigator.serviceWorker.ready);
  // The first document is sometimes uncontrolled until one refresh.
  await page.reload();
  await page.waitForFunction(()=>navigator.serviceWorker.controller!==null,{timeout:20_000});
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.brand')).toContainText('수학');
  await page.locator('.grade-button').first().click();
  await expect(page.locator('.interactive-lab--blocks')).toBeVisible();
  await page.locator('.grade-button').nth(5).click();
  await expect(page.locator('.interactive-lab--fractions')).toBeVisible();
  await context.setOffline(false);
});
