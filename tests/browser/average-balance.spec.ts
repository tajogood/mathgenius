import {test,expect} from '@playwright/test';

async function openAverageLesson(page:import('@playwright/test').Page) {
 await page.goto('/');
 await page.getByRole('button',{name:/성취기준 121개 학습/}).click();
 await page.locator('#standard-search').fill('6수04-01');
 const entry=page.locator('.studio-lesson-link').filter({hasText:'6수04-01'});
 if(!await entry.isVisible())await page.locator('.studio-catalog-toggle').click();
 await entry.click();
 await expect(page.getByTestId('average-balance-lab')).toBeVisible();
}

test('학생이 사탕을 선택하고 다른 친구에게 한 개 전달하면 전체 26개가 보존된다',async({page})=>{
 await page.setViewportSize({width:1200,height:900});
 await openAverageLesson(page);
 const lab=page.getByTestId('average-balance-lab');
 await lab.getByRole('button',{name:'9·13·4 (나머지 있음)'}).click();
 await expect(lab.getByText('9 + 13 + 4 = 26개')).toBeVisible();
 await lab.getByRole('button',{name:'두 번째 친구 1번째 사탕 선택해 옮기기'}).click();
 await lab.getByRole('button',{name:'첫 번째 친구에게 사탕 한 개 전달'}).click();
 await expect(lab.getByText('10 + 12 + 4 = 26개')).toBeVisible();
 await expect(lab.getByText(/전체 26개는 그대로예요/)).toBeVisible();
});

test('실제 마우스 드래그로 두 번째 바구니 사탕을 첫 번째 바구니로 옮긴다',async({page})=>{
 await page.setViewportSize({width:1200,height:900});
 await openAverageLesson(page);
 const lab=page.getByTestId('average-balance-lab');
 await lab.getByRole('button',{name:'9·13·4 (나머지 있음)'}).click();
 const candy=lab.getByRole('button',{name:'두 번째 친구 1번째 사탕 선택해 옮기기'});
 const target=page.getByTestId('average-basket-0').getByRole('button',{name:'첫 번째 친구에게 사탕 한 개 전달'});
 await candy.scrollIntoViewIfNeeded();
 const from=await candy.boundingBox(),to=await target.boundingBox();
 expect(from).not.toBeNull();expect(to).not.toBeNull();
 await page.mouse.move(from!.x+from!.width/2,from!.y+from!.height/2);
 await page.mouse.down();
 await page.mouse.move(to!.x+to!.width/2,to!.y+to!.height/2,{steps:10});
 await page.mouse.up();
 await expect(lab.getByText('10 + 12 + 4 = 26개')).toBeVisible();
});

test('26개를 세 명에게 고르게 나누면 8개씩 받고 2개를 세 조각으로 나눠 받는 그림이 보인다',async({page})=>{
 await openAverageLesson(page);
 const lab=page.getByTestId('average-balance-lab');
 await lab.getByRole('button',{name:'9·13·4 (나머지 있음)'}).click();
 for(let i=0;i<4;i++)await lab.getByRole('button',{name:/사탕 한 개 고르게 옮기기/}).click();
 await expect(lab.getByText('9 + 9 + 8 = 26개')).toBeVisible();
 await lab.getByRole('button',{name:/남은 사탕까지 똑같이 나누기/}).click();
 await expect(lab.getByTestId('average-equal-shares')).toBeVisible();
 await expect(lab.getByTestId('average-equal-shares').locator('.average-share')).toHaveCount(3);
 await expect(lab.getByRole('math',{name:'3분의 2'}).first()).toBeVisible();
 await expect(lab.getByText(/평균은 원래의 세 값 중 하나일 필요가 없어요/)).toBeVisible();
});

test('휴대폰에서도 평균 개념 확인 문제와 네 선택지가 한 화면에 놓인다',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await openAverageLesson(page);
 for(let i=0;i<2;i++)await page.getByRole('button',{name:/다음 장면/}).click();
 await page.getByRole('button',{name:/개념 확인 시작/}).click();
 await expect(page.locator('.studio-option')).toHaveCount(4);
 const bounds=await page.evaluate(()=>{
  const title=document.querySelector('.studio-card h3')?.getBoundingClientRect();
  const buttons=Array.from(document.querySelectorAll('.studio-option'));
  return {top:title?.top,bottom:buttons.at(-1)?.getBoundingClientRect().bottom,
   screen:innerHeight,width:innerWidth,scroll:document.documentElement.scrollWidth};
 });
 expect(bounds.scroll).toBeLessThanOrEqual(bounds.width+2);
 expect(bounds.top).toBeGreaterThanOrEqual(0);
 expect(bounds.bottom).toBeLessThanOrEqual(bounds.screen-4);
});
