import {test,expect} from '@playwright/test';

async function openRectangleLesson(page:import('@playwright/test').Page,id:string){
 await page.goto('/');
 await page.getByRole('button',{name:/성취기준 121개 학습/}).click();
 await page.locator('#standard-search').fill(id);
 const entry=page.locator('.studio-lesson-link').filter({hasText:id});
 if(!await entry.isVisible())await page.locator('.studio-catalog-toggle').click();
 await entry.click();
 await expect(page.getByTestId('rectangle-concept-lab')).toBeVisible();
}

test('사각형 넓이: 1cm² 5개씩 세 줄을 실제 터치해 15cm²를 만든다',async({page})=>{
 await page.setViewportSize({width:1100,height:850});
 await openRectangleLesson(page,'6수03-13');
 const lab=page.getByTestId('rectangle-concept-lab');
 await lab.getByRole('button',{name:'5×3 예시'}).click();
 for(let i=1;i<=3;i++)await lab.getByRole('button',{name:new RegExp(i+'번째 줄, 1cm² 칸 5개')}).click();
 await expect(lab.getByText('5 + 5 + 5 = 15칸')).toBeVisible();
 await expect(lab.getByText('✓ 전체 넓이 5 × 3 = 15cm²')).toBeVisible();
});

test('사각형 둘레: 바깥 네 변을 누를 때마다 cm 단위로 합해 16cm가 된다',async({page})=>{
 await page.setViewportSize({width:1100,height:850});
 await openRectangleLesson(page,'6수03-11');
 const lab=page.getByTestId('rectangle-concept-lab');
 await lab.getByRole('button',{name:'5×3 예시'}).click();
 for(const label of ['윗변 5cm','오른쪽 변 3cm','아랫변 5cm','왼쪽 변 3cm']){
  await lab.getByRole('button',{name:label+' 따라가기'}).click();
 }
 await expect(lab.getByText('5cm + 3cm + 5cm + 3cm = 16cm')).toBeVisible();
 await expect(lab.getByText('✓ 전체 둘레 5 + 3 + 5 + 3 = 16cm')).toBeVisible();
});

test('주황 모서리를 직접 드래그하면 직사각형의 칸 수와 식이 바뀐다',async({page})=>{
 await page.setViewportSize({width:1100,height:850});
 await openRectangleLesson(page,'6수03-13');
 const lab=page.getByTestId('rectangle-concept-lab');
 await lab.getByRole('button',{name:'5×3 예시'}).click();
 const box=await lab.getByRole('button',{name:/주황 손잡이를 드래그/}).boundingBox();
 expect(box).not.toBeNull();
 const x=box!.x+box!.width/2,y=box!.y+box!.height/2;
 await page.mouse.move(x,y);
 await page.mouse.down();
 await page.mouse.move(x+48,y+24,{steps:8});
 await page.mouse.up();
 await expect(lab.getByRole('group',{name:'가로 7칸 세로 4칸 직사각형'})).toBeVisible();
 await lab.getByRole('button',{name:'전체 확인'}).click();
 await expect(lab.getByText('✓ 전체 넓이 7 × 4 = 28cm²')).toBeVisible();
});

test('모바일에서 넓이·둘레 수업의 문제와 네 개 답안은 한 화면에 있다',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await openRectangleLesson(page,'6수03-13');
 for(let i=0;i<2;i++)await page.getByRole('button',{name:/다음 장면/}).click();
 await page.getByRole('button',{name:/개념 확인 시작/}).click();
 await expect(page.locator('.studio-option')).toHaveCount(4);
 const positions=await page.evaluate(()=>{
  const title=document.querySelector('.studio-card h3')?.getBoundingClientRect();
  const options=Array.from(document.querySelectorAll('.studio-option'));
  return {top:title?.top,bottom:options.at(-1)?.getBoundingClientRect().bottom,
    scrollWidth:document.documentElement.scrollWidth,width:innerWidth,height:innerHeight};
 });
 expect(positions.scrollWidth).toBeLessThanOrEqual(positions.width+2);
 expect(positions.top).toBeGreaterThanOrEqual(0);
 expect(positions.bottom).toBeLessThanOrEqual(positions.height-4);
});
