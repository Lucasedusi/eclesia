import { describe, expect, it } from "vitest";
import { eventFormSchema, groupSchema, paymentStatusSchema, publicPixPaymentSchema, registrationSchema } from "./event.schemas";

const baseEvent = { id:"",name:"Congresso 2027",slug:"congresso-2027",description:"",eventType:"CONGRESS",visibility:"PUBLIC",eventScope:"CHURCH",regionId:"",congregationId:"",ministryId:"",startsAt:"2027-08-20T19:00",endsAt:"2027-08-22T18:00",registrationStartsAt:"2027-01-01T08:00",registrationEndsAt:"2027-08-19T23:00",timezone:"America/Sao_Paulo",registrationMode:"MIXED",capacity:500,requiresPayment:false,requiresGroupResponsible:false,requiresPastorInfo:false,requiresGenderTotals:false,locationName:"",zipCode:"",address:"",number:"",complement:"",district:"",city:"Porangatu",state:"GO",country:"Brasil",notes:"" };

describe("eventFormSchema",()=>{
  it("aceita um rascunho coerente",()=>{expect(eventFormSchema.safeParse(baseEvent).success).toBe(true);});
  it("rejeita término anterior ao início",()=>{const result=eventFormSchema.safeParse({...baseEvent,endsAt:"2027-08-19T18:00"});expect(result.success).toBe(false);});
  it("exige alvo para escopo regional",()=>{const result=eventFormSchema.safeParse({...baseEvent,eventScope:"REGION",regionId:""});expect(result.success).toBe(false);});
});

describe("registrationSchema",()=>{
  const base={eventId:"123e4567-e89b-12d3-a456-426614174000",participantKind:"VISITOR",memberId:"",regionId:"",congregationId:"",participantName:"Ana da Silva",participantGender:"FEMALE",participantPhone:"62999999999",preferredPaymentMethod:"PIX",items:[]};
  it("aceita uma inscrição simples de visitante",()=>expect(registrationSchema.safeParse(base).success).toBe(true));
  it("exige a seleção do cadastro no modo membro",()=>expect(registrationSchema.safeParse({...base,participantKind:"MEMBER",memberId:""}).success).toBe(false));
});

describe("groupSchema",()=>{
  it("exige ao menos um participante",()=>{const result=groupSchema.safeParse({eventId:"123e4567-e89b-12d3-a456-426614174000",originChurchName:"",originFieldName:"",originCity:"Porangatu",originState:"GO",responsibleName:"Responsável",responsiblePhone:"",responsibleEmail:"",pastorName:"",pastorPhone:"",notes:"",participants:[]});expect(result.success).toBe(false);});
});

describe("paymentStatusSchema",()=>{
  it("aceita o registro de pagamento não concluído",()=>expect(paymentStatusSchema.safeParse({paymentId:"123e4567-e89b-12d3-a456-426614174000",status:"FAILED",reason:"Transação recusada"}).success).toBe(true));
});

describe("publicPixPaymentSchema",()=>{
  const checkoutToken="a".repeat(48);
  it("aceita e normaliza CPF válido",()=>{const result=publicPixPaymentSchema.safeParse({checkoutToken,payerEmail:"pagador@exemplo.com",payerCpf:"529.982.247-25"});expect(result.success).toBe(true);if(result.success)expect(result.data.payerCpf).toBe("52998224725");});
  it("rejeita CPF ou e-mail inválidos",()=>expect(publicPixPaymentSchema.safeParse({checkoutToken,payerEmail:"inválido",payerCpf:"111.111.111-11"}).success).toBe(false));
});
