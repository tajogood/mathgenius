import { test,expect } from '@playwright/test';

const viewports=[
  {name:'small-phone',width:360,height:640},
  {name:'regular-phone',width:390,height:844},
  {name:'tablet',width:768,height:1024},
  {name:'desktop',width:1440,height:900},
] as const;

for(const size of viewports){
 test('성취기준 교실 '+size.name+' 화면에 네 개의 선택지가 모두 보인다',async({page})=>{
  await page.setViewportSize({width:size.width,height:size.height});
  await page.goto('/');
  await page.getByRole('button',{name:/성취기준 121개 학습/}).click();
  for(let i=0;i<2;i++)await page.getByRole('button',{name:/다음 장면/}).click();
  await page.getByRole('button',{name:/개념 확인 시작/}).click();
  await expect(page.locator('.studio-option')).toHaveCount(4);
  const bounds=await page.evaluate(()=>{
    const q=document.querySelector('.studio-card h3')?.getBoundingClientRect();
    const b=Array.from(document.querySelectorAll('.studio-option')).map(x=>x.getBoundingClientRect());
    return {
      scrollWidth:document.documentElement.scrollWidth,width:window.innerWidth,
      questionTop:q?.top,lastBottom:b.at(-1)?.bottom,windowHeight:window.innerHeight,
    };
  });
  expect(bounds.scrollWidth).toBeLessThanOrEqual(size.width+2);
  expect(bounds.questionTop).toBeGreaterThanOrEqual(0);
  expect(bounds.lastBottom).toBeLessThanOrEqual(size.height-4);
 });
}

test('성취기준별 실험은 별도 도형 교구와 개별 평가를 연결한다',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:/성취기준 121개 학습/}).click();
 await page.locator('#standard-search').fill('6수03-14');
 await page.locator('.studio-lesson-link').filter({hasText:'6수03-14'}).click();
 await expect(page.locator('[data-testid="area-shape-experiment"]')).toBeVisible();
 await page.getByRole('button',{name:'사다리꼴'}).click();
 await expect(page.getByText(/윗변 \+ 아랫변/)).toBeVisible();
 for(let i=0;i<2;i++)await page.getByRole('button',{name:/다음 장면/}).click();
 await page.getByRole('button',{name:/개념 확인 시작/}).click();
 await expect(page.getByText(/개념 확인 1 \/ 4/)).toBeVisible();
});
