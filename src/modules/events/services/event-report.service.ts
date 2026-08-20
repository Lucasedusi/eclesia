import "server-only";

import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { loadEventReport } from "./event.service";

type ReportType = "participants"|"financial"|"checkins"|"executive";
const labels:Record<ReportType,string>={participants:"Participantes",financial:"Financeiro",checkins:"Presença",executive:"Resumo executivo"};
function rowsFor(type:ReportType,data:Awaited<ReturnType<typeof loadEventReport>>,status?:string){
  if(type==="participants")return data.registrations.filter((row)=>!status||row.status===status).map((row)=>({Inscrição:row.registrationNumber,Participante:row.participantName,Tipo:row.participantType,Telefone:row.participantPhone,Regional:row.regionName,Congregação:row.congregationName,Situação:row.status,"Situação financeira":row.paymentStatus,"Valor previsto":row.totalAmount,"Valor recebido":row.paidAmount}));
  if(type==="financial")return data.payments.filter((row)=>!status||row.status===status).map((row)=>({Pagamento:row.paymentNumber,Pagador:row.payerName,Método:row.method,Situação:row.status,Valor:row.amount,"Pago em":row.paidAt}));
  if(type==="checkins")return data.registrations.filter((row)=>!status||row.status===status).map((row)=>{const checkin=data.checkins.find((item)=>item.registrationId===row.id&&item.status==="CHECKED_IN");return{Inscrição:row.registrationNumber,Participante:row.participantName,Presença:checkin?"Presente":row.status==="CONFIRMED"?"Ausente":"Não elegível",Método:checkin?.method??"","Check-in":checkin?.checkedInAt??""};});
  const confirmed=data.registrations.filter((row)=>row.status==="CONFIRMED").length;const received=data.payments.filter((row)=>row.status==="CONFIRMED").reduce((sum,row)=>sum+row.amount,0);return[{Indicador:"Evento",Valor:data.event.name},{Indicador:"Capacidade",Valor:data.event.capacity??"Ilimitada"},{Indicador:"Ocupação",Valor:data.event.occupied},{Indicador:"Confirmados",Valor:confirmed},{Indicador:"Grupos",Valor:data.groups.length},{Indicador:"Check-ins",Valor:data.checkins.filter((row)=>row.status==="CHECKED_IN").length},{Indicador:"Recebido",Valor:received}];
}
function csvEscape(value:unknown){const text=String(value??"");return /[",\n]/.test(text)?`"${text.replace(/"/g,'""')}"`:text;}

export async function generateEventReport(eventId:string,type:ReportType,format:"xlsx"|"csv",status?:string){
  const data=await loadEventReport(eventId);const rows=rowsFor(type,data,status);const columns=Object.keys(rows[0]??{Resultado:"Sem dados"});let body:Buffer;let contentType:string;let extension:string;
  if(format==="csv"){const content=[columns.join(","),...rows.map((row)=>columns.map((column)=>csvEscape((row as Record<string,unknown>)[column])).join(","))].join("\r\n");body=Buffer.from(`\uFEFF${content}`,"utf8");contentType="text/csv; charset=utf-8";extension="csv";}else{const workbook=new ExcelJS.Workbook();workbook.creator="EKLESIA";const sheet=workbook.addWorksheet(labels[type],{views:[{state:"frozen",ySplit:1}]});sheet.columns=columns.map((header)=>({header,key:header,width:Math.min(42,Math.max(14,header.length+3))}));rows.forEach((row)=>sheet.addRow(row));const header=sheet.getRow(1);header.height=24;header.eachCell((cell)=>{cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF415BA5"}};cell.font={color:{argb:"FFFFFFFF"},bold:true};});sheet.autoFilter={from:{row:1,column:1},to:{row:Math.max(1,sheet.rowCount),column:columns.length}};const output=await workbook.xlsx.writeBuffer();body=Buffer.from(output);contentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";extension="xlsx";}
  const supabase=await createClient();await supabase.rpc("log_audit",{p_church_id:data.event.churchId,p_module:"EVENTS",p_action:"EXPORT_REPORT",p_entity_type:"EVENT",p_entity_id:eventId,p_entity_label:data.event.name,p_description:"Relatório de evento exportado",p_old_values:null,p_new_values:null,p_metadata:{report:type,format,status:status??null,row_count:rows.length},p_severity:"INFO"});
  return{body,contentType,fileName:`evento-${data.event.publicCode}-${type}.${extension}`};
}

export function isEventReportType(value:string):value is ReportType{return["participants","financial","checkins","executive"].includes(value);}
