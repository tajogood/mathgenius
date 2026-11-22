import {test,expect} from '@playwright/test';

async function openStandard(page: import('@playwright/test').Page,id:string) {
  await page.goto('/');
  await page.getByRole('button',{name:/성취기준 121개 학습/}).click();
  await page.locator('#standard-search').fill(id);
  const entry=page.locator('.studio-lesson-link').filter({hasText:id});
  if(!await entry.isVisible()){
    await page.locator('.studio-catalog-toggle').click();
  }
  await entry.click();
}

test('합동과 대칭의 도형을 마우스로 직접 끌어서 이동한다',async({page})=>{
  await page.setViewportSize({width:1100,height:850});
  await openStandard(page,'6수03-02');
  const lab=page.getByTestId('symmetry-experiment');
  await expect(lab).toBeVisible();
  const wing=lab.locator('.lab-symmetry-draggable').first();
  const before=await wing.getAttribute('transform');
  const box=await wing.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x+box!.width/2,box!.y+box!.height/2);
  await page.mouse.down();
  await page.mouse.move(box!.x+box!.width/2-38,box!.y+box!.height/2-15,{steps:7});
  await page.mouse.up();
  const after=await wing.getAttribute('transform');
  expect(after).not.toBe(before);
});

test('합동의 주황 손잡이를 잡아 도형을 회전할 수 있다',async({page})=>{
  await page.setViewportSize({width:1100,height:850});
  await openStandard(page,'6수03-01');
  const lab=page.getByTestId('symmetry-experiment');
  const handle=lab.locator('.lab-symmetry-turn-handle');
  await expect(handle).toBeVisible();
  const box=await handle.boundingBox();
  expect(box).not.toBeNull();
  const sx=box!.x+box!.width/2,sy=box!.y+box!.height/2;
  await page.mouse.move(sx,sy);
  await page.mouse.down();
  await page.mouse.move(sx+45,sy+40,{steps:9});
  await page.mouse.up();
  await expect(lab.locator('.lab-math-feedback')).not.toContainText('회전 0°');
});

test('소수 곱셈의 100칸 모형에서 누른 칸에 따라 소수 값이 바뀐다',async({page})=>{
  await openStandard(page,'6수01-13');
  const lab=page.getByTestId('decimal-multiplication-lab');
  await expect(lab).toBeVisible();
  await lab.getByRole('button',{name:/2번째 줄 3번째 칸/}).click();
  await expect(lab.getByText('0.3 × 0.2 = 0.06')).toBeVisible();
  await lab.getByRole('button',{name:/반복 덧셈으로도 보기/}).click();
  await expect(lab.getByText(/÷ 10 = 0.06/)).toBeVisible();
});

test('휴대폰에서도 소수 곱셈 문제와 네 선택지가 스크롤 없이 화면 안에 들어온다',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await openStandard(page,'6수01-13');
  for(let i=0;i<2;i++)await page.getByRole('button',{name:/다음 장면/}).click();
  await page.getByRole('button',{name:/개념 확인 시작/}).click();
  const choices=page.locator('.studio-option');
  await expect(choices).toHaveCount(4);
  const coordinates=await page.evaluate(()=>{
    const title=document.querySelector('.studio-card h3')?.getBoundingClientRect();
    const answers=Array.from(document.querySelectorAll('.studio-option'));
    const last=answers.at(-1)?.getBoundingClientRect();
    return {top:title?.top,bottom:last?.bottom,scrollWidth:document.documentElement.scrollWidth,
      width:innerWidth,height:innerHeight};
  });
  expect(coordinates.scrollWidth).toBeLessThanOrEqual(coordinates.width+2);
  expect(coordinates.top).toBeGreaterThanOrEqual(0);
  expect(coordinates.bottom).toBeLessThanOrEqual(coordinates.height-4);
});
