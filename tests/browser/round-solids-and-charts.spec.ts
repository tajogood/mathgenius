import {test,expect} from '@playwright/test';

async function openStandard(page:import('@playwright/test').Page,id:string){
 await page.goto('/?guest=1');
 await page.getByRole('button',{name:/성취기준 121개 학습/}).click();
 await page.locator('#standard-search').fill(id);
 const entry=page.locator('.studio-lesson-link').filter({hasText:id});
 if(!await entry.isVisible())await page.locator('.studio-catalog-toggle').click();
 await entry.click();
}

test('원뿔을 마우스로 직접 드래그하면 다각형 곡면 좌표가 바뀐다',async({page})=>{
 await page.setViewportSize({width:1200,height:900});
 await openStandard(page,'6수03-07');
 const lab=page.getByTestId('round-solid-explorer');
 await lab.getByRole('button',{name:'원뿔',exact:true}).click();
 const svg=lab.getByTestId('round-solid-rotate-stage');
 const before=await svg.locator('.round-surface-facet').first().getAttribute('points');
 await svg.scrollIntoViewIfNeeded();
 const b=await svg.boundingBox();
 expect(b).not.toBeNull();
 await page.mouse.move(b!.x+b!.width/2,b!.y+b!.height/2);
 await page.mouse.down();
 await page.mouse.move(b!.x+b!.width/2+68,b!.y+b!.height/2+28,{steps:7});
 await page.mouse.up();
 expect(await svg.locator('.round-surface-facet').first().getAttribute('points')).not.toBe(before);
 await lab.getByRole('button',{name:/전개도 펼치기/}).click();
 await expect(lab.getByTestId('round-solid-net')).toBeVisible();
});

test('띠그래프의 색깔 경계를 그림 위에서 직접 끌면 파랑과 주황의 비율이 바뀐다',async({page})=>{
 await openStandard(page,'6수04-02');
 const chart=page.getByRole('slider',{name:/경계를 직접 드래그/});
 await chart.scrollIntoViewIfNeeded();
 const bounds=await chart.boundingBox();
 expect(bounds).not.toBeNull();
 await page.mouse.move(bounds!.x+bounds!.width*.25,bounds!.y+bounds!.height/2);
 await page.mouse.down();
 await page.mouse.move(bounds!.x+bounds!.width*.8,bounds!.y+bounds!.height/2,{steps:8});
 await page.mouse.up();
 await expect(chart).toHaveAttribute('aria-valuenow','80');
 const lab=page.locator('.interactive-lab--charts');
 await expect(lab.getByText('80%',{exact:true})).toBeVisible();
});

test('원그래프의 경계는 마우스로 아래쪽을 가리키면 50%가 된다',async({page})=>{
 await openStandard(page,'6수04-03');
 const chart=page.getByRole('slider',{name:/경계를 직접 드래그/});
 await chart.scrollIntoViewIfNeeded();
 const bounds=await chart.boundingBox();
 expect(bounds).not.toBeNull();
 await page.mouse.move(bounds!.x+bounds!.width/2,bounds!.y+bounds!.height*.8);
 await page.mouse.down();
 await page.mouse.up();
 await expect(chart).toHaveAttribute('aria-valuenow','50');
});

test('휴대폰에서도 원기둥 원뿔 구 모형이 가로 스크롤 없이 직접 조작된다',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await openStandard(page,'6수03-07');
 const stage=page.getByTestId('round-solid-rotate-stage');
 await stage.scrollIntoViewIfNeeded();
 const b=await stage.boundingBox();
 expect(b).not.toBeNull();
 const before=await stage.locator('.round-surface-facet').first().getAttribute('points');
 await page.mouse.move(b!.x+b!.width/2,b!.y+b!.height/2);
 await page.mouse.down();
 await page.mouse.move(b!.x+b!.width/2-45,b!.y+b!.height/2+30,{steps:7});
 await page.mouse.up();
 expect(await stage.locator('.round-surface-facet').first().getAttribute('points')).not.toBe(before);
 const size=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
 expect(size.scroll).toBeLessThanOrEqual(size.width+2);
});
