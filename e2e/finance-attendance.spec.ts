import {test,expect} from "@playwright/test";
import {readFileSync} from "node:fs";
test('attendance groups tithe, worship and missions into one receipt',async({page})=>{
 test.skip(!process.env.E2E_FINANCE_FIXTURE,'Local fixture required');const f=JSON.parse(readFileSync(process.env.E2E_FINANCE_FIXTURE!,'utf8'));
 await page.goto(`/financeiro/atendimento?unidade=${f.unitId}&mes=2026-10`);
 await page.getByLabel('Data',{exact:true}).filter({visible:true}).fill('2026-10-04');
 await page.getByRole('combobox',{name:'Caixa ou conta',exact:true}).selectOption(f.boxes[f.unitId].cash);
 await expect(page.getByRole('combobox',{name:'Forma de pagamento',exact:true})).toHaveValue(f.cashMethod);
 await page.getByLabel('Nome para busca').fill('Pessoa Financeiro');await page.getByRole('button',{name:'Buscar pessoa',exact:true}).click();await page.getByRole('button',{name:/Pessoa Financeiro Teste/}).click();
 await page.getByRole('combobox',{name:'Categoria',exact:true}).selectOption(f.titheId);await page.getByLabel('Valor (R$)',{exact:true}).fill('200,00');await page.getByRole('combobox',{name:'Classificação do dízimo',exact:true}).selectOption(f.classificationId);
 await page.getByRole('button',{name:'Adicionar contribuição'}).click();await page.getByRole('combobox',{name:'Categoria',exact:true}).nth(1).selectOption(f.offeringId);await page.getByLabel('Valor (R$)',{exact:true}).nth(1).fill('20,00');
 await page.getByRole('button',{name:'Adicionar contribuição'}).click();await page.getByRole('combobox',{name:'Categoria',exact:true}).nth(2).selectOption(f.missionsOfferingId);await page.getByLabel('Valor (R$)',{exact:true}).nth(2).fill('50,00');
 await expect(page.getByTestId('attendance-total')).toHaveText('R$ 270,00');await page.getByRole('button',{name:'Confirmar atendimento'}).click();await expect(page.getByText('Atendimento confirmado.',{exact:false})).toBeVisible();
 await expect(page.getByLabel('Nome para busca')).toHaveValue('');await expect(page.getByRole('combobox',{name:'Classificação do dízimo',exact:true})).toHaveValue('');await expect(page.getByRole('combobox',{name:'Caixa ou conta',exact:true})).toHaveValue(f.boxes[f.unitId].cash);
 const href=await page.getByRole('link',{name:'Abrir comprovante'}).getAttribute('href');await page.goto(href!);await expect(page.getByTestId('receipt-item')).toHaveCount(3);await expect(page.getByText('R$ 270,00',{exact:true})).toBeVisible();
 await page.evaluate(()=>{window.print=()=>{};});await page.getByRole('button',{name:'Imprimir comprovante'}).click();await page.getByRole('combobox',{name:'Largura do papel',exact:true}).selectOption('58');await page.getByRole('button',{name:'Imprimir comprovante'}).click();await expect(page.getByTestId('receipt-item')).toHaveCount(3);
});
