import {test,expect} from '@playwright/test';

async function openStandard(page:import('@playwright/test').Page,id:string){
 await page.goto('/?guest=1');
 await page.getByRole('button',{name:/성취기준 121개 학습/}).click();
 await page.locator('#standard-search').fill(id);
 const entry=page.locator('.studio-lesson-link').filter({hasText:id});
 if(!await entry.isVisible())await page.locator('.studio-catalog-toggle').click();
 await entry.click();
 await expect(page.getByTestId('solid-3d-explorer')).toBeVisible();
}

test('직육면체를 실제 마우스로 끌면 연결된 6개 면이 함께 회전한다',async({page})=>{
 await page.setViewportSize({width:1100,height:850});
 await openStandard(page,'6수03-03');
 const lab=page.getByTestId('solid-3d-explorer');
 await expect(lab.locator('.solid-cuboid-face')).toHaveCount(6);
 const model=lab.locator('.solid-cuboid');
 const before=await model.evaluate((el)=>el.getAttribute('style'));
 const stage=page.getByTestId('solid-rotate-stage');
 const box=await stage.boundingBox();
 expect(box).not.toBeNull();
 const x=box!.x+box!.width*.5,y=box!.y+box!.height*.5;
 await page.mouse.move(x,y);
 await page.mouse.down();
 await page.mouse.move(x+100,y+34,{steps:12});
 await page.mouse.up();
 const after=await model.evaluate((el)=>el.getAttribute('style'));
 expect(after).not.toBe(before);
 await expect(lab.getByRole('button',{name:'모서리 12개'})).toBeVisible();
});

test('입체 모형의 면을 누르면 선택 표시와 실제 면적이 바뀐다',async({page})=>{
 await page.setViewportSize({width:1100,height:850});
 await openStandard(page,'6수03-03');
 const lab=page.getByTestId('solid-3d-explorer');
 const top=lab.locator('[data-solid-face="top"]');
 await top.click();
 await expect(lab.getByText(/윗면의 크기는 4cm × 2cm/)).toBeVisible();
 await expect(top).toHaveClass(/solid-cuboid-face--selected/);
});

test('전개도 여섯 면을 누르면 해당 3D 면과 한 쌍으로 강조된다',async({page})=>{
 await openStandard(page,'6수03-04');
 const lab=page.getByTestId('solid-3d-explorer');
 await lab.getByRole('button',{name:/전개도 펼치기/}).click();
 await expect(lab.locator('.solid-net-face')).toHaveCount(6);
 await lab.getByRole('button',{name:'전개도 뒷면 선택'}).click();
 await expect(lab.locator('[data-solid-face="back"]')).toHaveClass(/solid-cuboid-face--selected/);
 await expect(lab.getByText(/뒷면의 크기는 4cm × 3cm/)).toBeVisible();
 await lab.getByRole('button',{name:'정육면체'}).click();
 await expect(lab.getByText(/앞면의 크기는 3cm × 3cm/)).toBeVisible();
});

test('휴대폰에서도 3D 모형을 손으로 드래그해 돌릴 수 있고 가로 스크롤이 없다',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await openStandard(page,'6수03-03');
 const lab=page.getByTestId('solid-3d-explorer');
 const model=lab.locator('.solid-cuboid');
 const before=await model.evaluate(el=>el.getAttribute('style'));
 const stage=page.getByTestId('solid-rotate-stage');
 await stage.scrollIntoViewIfNeeded();
 const b=await stage.boundingBox();
 expect(b).not.toBeNull();
 await page.mouse.move(b!.x+b!.width/2,b!.y+b!.height/2);
 await page.mouse.down();
 await page.mouse.move(b!.x+b!.width/2-72,b!.y+b!.height/2+18,{steps:6});
 await page.mouse.up();
 expect(await model.evaluate(el=>el.getAttribute('style'))).not.toBe(before);
 const scroll=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));
 expect(scroll.scrollWidth).toBeLessThanOrEqual(scroll.width+2);
});
