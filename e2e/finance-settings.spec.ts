import {test,expect} from "@playwright/test";
test("admin creates categories and classifications",async({page})=>{
 test.skip(!process.env.E2E_FINANCE_FIXTURE,"Local financial fixture required");
 await page.goto('/financeiro/configuracoes');
 await page.getByRole('button',{name:'Categorias',exact:true}).click();
 await page.getByRole('button',{name:'Novo cadastro'}).click();
 const name=`Oferta teste ${Date.now()}`;
 await page.getByLabel('Nome',{exact:true}).fill(name);
 await page.getByRole('button',{name:'Salvar cadastro'}).click();
 await expect(page.getByText(name,{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Classificações',exact:true}).click();
 await page.getByRole('button',{name:'Novo cadastro'}).click();
 await page.getByLabel('Nome',{exact:true}).fill(`Diácono teste ${Date.now()}`);
 await page.getByRole('button',{name:'Salvar cadastro'}).click();
 await expect(page.getByRole('dialog')).toHaveCount(0);
});
