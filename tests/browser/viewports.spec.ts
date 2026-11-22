import { test, expect } from '@playwright/test';

const screens = [
  { name: 'small-phone', width: 360, height: 640 },
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet-portrait', width: 768, height: 1024 },
  { name: 'tablet-landscape', width: 1024, height: 768 },
  { name: 'desktop', width: 1440, height: 900 },
] as const;

async function showQuestion(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.locator('.grade-button').first().click();
  await expect(page.locator('.interactive-lab--blocks')).toBeVisible();
  for (let n=0;n<3;n++) await page.locator('.guide-actions .btn--primary').click();
  await expect(page.locator('.app-shell--question')).toBeVisible();
  await expect(page.locator('.choice')).toHaveCount(4);
}

for (const screen of screens) {
  test(screen.name+'에서 문제와 답안 보기 4개가 화면에 들어온다',async ({page})=>{
    await page.setViewportSize({width:screen.width,height:screen.height});
    await showQuestion(page);
    const layout=await page.evaluate(()=>{
      const choices=[...document.querySelectorAll('.choice')];
      const question=document.querySelector('.guide-card h3');
      const first=choices[0]?.getBoundingClientRect(),last=choices.at(-1)?.getBoundingClientRect();
      const prompt=question?.getBoundingClientRect();
      return {
        width:document.documentElement.scrollWidth,
        windowWidth:window.innerWidth,
        windowHeight:window.innerHeight,
        promptTop:prompt?.top,
        choicesStart:first?.top,
        choicesEnd:last?.bottom,
      };
    });
    expect(layout.width,'가로 스크롤은 생기면 안 돼요').toBeLessThanOrEqual(screen.width+2);
    expect(layout.promptTop,'문제는 화면 위에 보여야 해요').toBeGreaterThanOrEqual(0);
    expect(layout.choicesStart).toBeGreaterThanOrEqual(0);
    expect(layout.choicesEnd,'네 번째 선택지까지 화면에 보여야 해요').toBeLessThanOrEqual(screen.height-4);
    await expect(page.locator('.choice').first()).toBeVisible();
    await expect(page.locator('.choice').last()).toBeVisible();
  });
}

test('모바일에서 블록을 터치하고 학년·학기 단원을 바꿀 수 있다',async ({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  const page=await context.newPage();
  await page.goto('/');
  await page.locator('.grade-button').first().click();
  const first=page.getByRole('button',{name:/1번째 블록 세기/});
  await first.tap();
  await expect(first).toHaveAttribute('aria-pressed','true');
  await first.tap();
  await expect(first).toHaveAttribute('aria-pressed','false');
  await page.locator('.grade-button').nth(5).click();
  await page.locator('#lesson-picker').selectOption('6-2-5');
  await expect(page.locator('.interactive-lab--circle')).toBeVisible();
  await context.close();
});

test('분수 막대의 색칠을 바꾸면 실제 분수 계산도 달라진다',async({page})=>{
  await page.setViewportSize({width:1024,height:768});
  await page.goto('/');
  const before=await page.locator('.lab-math-feedback').innerText();
  const cells=page.getByRole('button',{name:/분수 칸/});
  expect(await cells.count()).toBeGreaterThan(2);
  await cells.last().click();
  const after=await page.locator('.lab-math-feedback').innerText();
  expect(after).not.toBe(before);
});
