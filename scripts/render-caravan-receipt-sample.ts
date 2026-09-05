import {writeFile} from "node:fs/promises";
import {createCaravanReceiptPdf} from "../src/modules/events/services/event-caravan-receipt-pdf.service";

const pdf=await createCaravanReceiptPdf({
  groupNumber:"CAR-000128",eventName:"Congresso Estadual 2026",
  hostChurchName:"Assembleia de Deus de Porangatu",hostChurchCity:"Porangatu",hostChurchState:"GO",
  seniorPastorName:"Pr. Presidente José Silva",seniorPastorSpouseName:"Pra. Maria Silva",
  originChurchName:"Assembleia de Deus — Campo Central",originCity:"Gurupi",originState:"TO",
  responsibleName:"Responsável da Caravana",responsiblePhone:"(62) 99999-9999",pastorName:"Pr. Responsável",
  totalRegistrations:100,maleCount:45,femaleCount:55,
  items:[{name:"Inscrição",quantity:100,unitPrice:50,totalPrice:5000},{name:"Camiseta",quantity:40,unitPrice:35,totalPrice:1400}],
  totalAmount:6400,paidAmount:2500,remainingAmount:3900,paymentStatus:"PARTIAL",
  createdAt:"2026-08-29T12:00:00Z",updatedAt:"2026-08-29T12:00:00Z",verificationToken:"0123456789abcdef0123456789abcdef",
});
await writeFile("/workspace/scratch/6edfdec14102/output/caravan-receipt-sample.pdf",pdf);
