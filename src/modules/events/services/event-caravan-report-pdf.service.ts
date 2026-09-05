import "server-only";

import {PDFDocument,StandardFonts,rgb,type PDFFont,type PDFPage} from "pdf-lib";
import type {EventCaravanReportPreview} from "../types/event.types";

const pageWidth=595.28,pageHeight=841.89,margin=42,blue=rgb(.25,.36,.65),ink=rgb(.08,.12,.2),muted=rgb(.42,.46,.54),line=rgb(.88,.9,.94),soft=rgb(.96,.97,.99);

function fit(text:string,font:PDFFont,size:number,width:number){let value=text||"—";if(font.widthOfTextAtSize(value,size)<=width)return value;while(value.length>1&&font.widthOfTextAtSize(`${value}…`,size)>width)value=value.slice(0,-1);return `${value}…`;}
function shortDate(value:string){return new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short",timeZone:"America/Sao_Paulo"}).format(new Date(value));}

export async function createEventCaravanReportPdf(report:EventCaravanReportPreview){
  const document=await PDFDocument.create();const regular=await document.embedFont(StandardFonts.Helvetica);const bold=await document.embedFont(StandardFonts.HelveticaBold);
  const columns=[...(report.config.columns.index?[{key:"index",label:"#",width:24}]:[]),{key:"cityAndState",label:"Cidade / UF",width:report.config.columns.originChurch?130:180},...(report.config.columns.originChurch?[{key:"originChurch",label:"Igreja / origem",width:132}]:[]),{key:"pastorName",label:"Pastor(a)",width:125},...(report.config.columns.responsible?[{key:"responsibleName",label:"Responsável",width:110}]:[]),{key:"totalRegistrations",label:"Inscrições",width:70}] as {key:string;label:string;width:number}[];
  const available=pageWidth-margin*2;const scale=available/columns.reduce((sum,column)=>sum+column.width,0);for(const column of columns)column.width*=scale;
  let page:PDFPage=document.addPage([pageWidth,pageHeight]),y=0,pageNumber=0;
  const addPage=()=>{page=document.addPage([pageWidth,pageHeight]);pageNumber+=1;page.drawRectangle({x:0,y:pageHeight-100,width:pageWidth,height:100,color:blue});page.drawText("EKLESIA · EVENTOS",{x:margin,y:pageHeight-34,size:9,font:bold,color:rgb(1,1,1)});page.drawText("Relatório de caravanas",{x:margin,y:pageHeight-59,size:20,font:bold,color:rgb(1,1,1)});page.drawText(fit(report.event.name,regular,9,available),{x:margin,y:pageHeight-79,size:9,font:regular,color:rgb(.9,.93,1)});page.drawText(`Página ${pageNumber}`,{x:pageWidth-margin-45,y:pageHeight-34,size:8,font:regular,color:rgb(.9,.93,1)});y=pageHeight-125;};
  const tableHeader=()=>{let x=margin;page.drawRectangle({x:margin,y:y-22,width:available,height:28,color:soft});for(const column of columns){const right=column.key==="totalRegistrations";const labelWidth=bold.widthOfTextAtSize(column.label,7.8);page.drawText(column.label,{x:right?x+column.width-labelWidth-6:x+5,y:y-13,size:7.8,font:bold,color:muted});x+=column.width;}y-=29;};
  addPage();document.removePage(0);
  page.drawText(report.churchName,{x:margin,y,size:10,font:bold,color:ink});if(report.config.showIssuedAt)page.drawText(`Emitido em ${shortDate(report.issuedAt)}`,{x:pageWidth-margin-135,y,size:7.5,font:regular,color:muted});y-=25;
  const cardWidth=(available-20)/3;const cards=[["Caravanas",String(report.totalCaravans)],["Inscrições",String(report.totalRegistrations)],["Cidades",String(report.cityCount)]];cards.forEach(([label,value],index)=>{const x=margin+index*(cardWidth+10);page.drawRectangle({x,y:y-49,width:cardWidth,height:55,color:soft,borderColor:line,borderWidth:1});page.drawText(label.toLocaleUpperCase("pt-BR"),{x:x+12,y:y-17,size:7,font:bold,color:muted});page.drawText(value,{x:x+12,y:y-40,size:19,font:bold,color:blue});});y-=72;
  if(report.config.showAppliedFilters&&report.appliedFilters.length){const text=report.appliedFilters.map((filter)=>`${filter.label}: ${filter.value}`).join(" · ");page.drawText(fit(text,regular,7.5,available),{x:margin,y,size:7.5,font:regular,color:muted});y-=20;}
  tableHeader();
  for(const row of report.caravans){if(y<74){addPage();tableHeader();}let x=margin;const record=row as unknown as Record<string,unknown>;for(const column of columns){const raw=String(record[column.key]??"—");const right=column.key==="totalRegistrations";const shown=fit(raw,column.key==="cityAndState"||right?bold:regular,8,column.width-10);const textWidth=(column.key==="cityAndState"||right?bold:regular).widthOfTextAtSize(shown,8);page.drawText(shown,{x:right?x+column.width-textWidth-6:x+5,y:y-15,size:8,font:column.key==="cityAndState"||right?bold:regular,color:ink});x+=column.width;}page.drawLine({start:{x:margin,y:y-23},end:{x:pageWidth-margin,y:y-23},thickness:.55,color:line});y-=27;}
  if(!report.caravans.length){page.drawText("Nenhuma caravana encontrada.",{x:margin,y:y-20,size:9,font:regular,color:muted});}
  for(const current of document.getPages()){current.drawLine({start:{x:margin,y:42},end:{x:pageWidth-margin,y:42},thickness:.6,color:line});current.drawText(`Evento ${report.event.publicCode} · ${report.totalRegistrations} inscrições em ${report.totalCaravans} caravanas`,{x:margin,y:27,size:7,font:regular,color:muted});}
  document.setTitle(`Relatório de caravanas - ${report.event.name}`);document.setAuthor("EKLESIA");return Buffer.from(await document.save());
}
