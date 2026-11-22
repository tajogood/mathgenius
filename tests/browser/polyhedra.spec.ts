import {test,expect} from '@playwright/test';

async function openStandard(page:import('@playwright/test').Page,id:string){
 await page.goto('/?guest=1');
 await page.getByRole('button',{name:/성취기준 121개 학습/}).click();
 await page.locator('#standard-search').fill(id);
 const entry=page.locator('.studio-lesson-link').filter({hasText:id});
 if(!await entry.isVisible())await page.locator('.studio-catalog-toggle').click();
 await entry.click();
 await expect(page.getByTestId('polyhedron-explorer')).toBeVisible();
 // Random assessment generators may begin with any 3–6-sided solid.
 // Pin the concept lesson to the triangular example before counting faces.
 const slider=page.getByTestId('polyhedron-explorer').getByRole('slider',{name:'밑면 변 수'});
 await slider.focus();
 await slider.press('Home');
}

test('삼각기둥을 마우스로 실제 드래그하면 면의 꼭짓점 좌표가 바뀐다',async({page})=>{
 await page.setViewportSize({width:1200,height:900});
 await openStandard(page,'6수03-05');
 const lab=page.getByTestId('polyhedron-explorer'),stage=page.getByTestId('polyhedron-rotate-stage');
 const polygons=stage.locator('.poly-face-polygon');
 await expect(polygons).toHaveCount(5);
 const before=await polygons.first().getAttribute('points');
 await stage.scrollIntoViewIfNeeded();
 const box=await stage.boundingBox();
 expect(box).not.toBeNull();
 await page.mouse.move(box!.x+box!.width/2,box!.y+box!.height/2);
 await page.mouse.down();
 await page.mouse.move(box!.x+box!.width/2+80,box!.y+box!.height/2+27,{steps:9});
 await page.mouse.up();
 expect(await polygons.first().getAttribute('points')).not.toBe(before);
 await expect(lab.getByText(/밑면 2개 \+ 옆면 3개 = 면 5개/)).toBeVisible();
});

test('입체의 밑면과 옆면을 클릭하고 전개도의 면에 일치시킬 수 있다',async({page})=>{
 await openStandard(page,'6수03-06');
 const lab=page.getByTestId('polyhedron-explorer');
 const net=lab.getByTestId('polyhedron-net');
 await expect(net).toBeVisible();
 await lab.getByRole('button',{name:'전개도의 아랫면 선택'}).click();
 await expect(lab.getByText(/선택한 면: 아랫면\(밑면\)/)).toBeVisible();
 await lab.getByRole('button',{name:'전개도의 2번째 옆면 선택'}).click();
 await expect(lab.getByText(/선택한 면: 2번째 옆면/)).toBeVisible();
 await lab.getByRole('button',{name:/전개도 접기/}).click();
 await expect(net).toHaveCount(0);
});

test('밑면을 사각형으로 바꾸고 각뿔로 변형하면 면·모서리·꼭짓점이 함께 바뀐다',async({page})=>{
 await openStandard(page,'6수03-05');
 const lab=page.getByTestId('polyhedron-explorer');
 await lab.getByRole('button',{name:/밑면 변 하나 더/}).click();
 await expect(lab.getByText(/4각기둥: 밑면 2개 \+ 옆면 4개 = 면 6개/)).toBeVisible();
 await lab.getByRole('button',{name:/각뿔/}).click();
 await expect(lab.getByText(/4각뿔: 밑면 1개 \+ 옆면 4개 = 면 5개/)).toBeVisible();
 await expect(lab.getByRole('button',{name:'모서리 8개'})).toBeVisible();
 await expect(lab.getByRole('button',{name:'꼭짓점 5개'})).toBeVisible();
});

test('휴대폰에서 3D 직접 드래그가 가능하고 문제·정답 보기 네 개가 한 화면에 들어온다',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await openStandard(page,'6수03-05');
 const stage=page.getByTestId('polyhedron-rotate-stage');
 await stage.scrollIntoViewIfNeeded();
 const before=await stage.locator('.poly-face-polygon').first().getAttribute('points');
 const bounds=await stage.boundingBox();
 expect(bounds).not.toBeNull();
 await page.mouse.move(bounds!.x+bounds!.width/2,bounds!.y+bounds!.height/2);
 await page.mouse.down();
 await page.mouse.move(bounds!.x+bounds!.width/2-60,bounds!.y+bounds!.height/2+10,{steps:7});
 await page.mouse.up();
 expect(await stage.locator('.poly-face-polygon').first().getAttribute('points')).not.toBe(before);
 for(let i=0;i<2;i++)await page.getByRole('button',{name:/다음 장면/}).click();
 await page.getByRole('button',{name:/개념 확인 시작/}).click();
 await expect(page.locator('.studio-option')).toHaveCount(4);
 const sizes=await page.evaluate(()=>{
  const title=document.querySelector('.studio-card h3')?.getBoundingClientRect();
  const options=Array.from(document.querySelectorAll('.studio-option'));
  return {top:title?.top,bottom:options.at(-1)?.getBoundingClientRect().bottom,
   width:innerWidth,scrollWidth:document.documentElement.scrollWidth,height:innerHeight};
 });
 expect(sizes.top).toBeGreaterThanOrEqual(0);
 expect(sizes.bottom).toBeLessThanOrEqual(sizes.height-4);
 expect(sizes.scrollWidth).toBeLessThanOrEqual(sizes.width+2);
});
