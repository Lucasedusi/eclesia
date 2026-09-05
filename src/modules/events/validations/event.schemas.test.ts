import { describe, expect, it } from "vitest";
import { eventFinancialReportConfigSchema, eventFormSchema, eventGeneralReportConfigSchema, eventListSchema, eventParticipantReportConfigSchema, expenseSchema, groupSchema, paymentStatusSchema, publicCaravanSchema, publicPixPaymentSchema, publicRegistrationSchema, registrationFieldSchema, registrationSchema } from "./event.schemas";

const baseEvent = { id:"",name:"Congresso 2027",slug:"congresso-2027",description:"",eventType:"CONGRESS",visibility:"PUBLIC",eventScope:"CHURCH",regionId:"",congregationId:"",ministryId:"",startsAt:"2027-08-20T19:00",endsAt:"2027-08-22T18:00",timezone:"America/Sao_Paulo",registrationMode:"MIXED",capacity:500,requiresPayment:false,requiresGroupResponsible:false,requiresPastorInfo:false,requiresGenderTotals:false,locationName:"",zipCode:"",address:"",number:"",complement:"",district:"",city:"Porangatu",state:"GO",country:"Brasil",notes:"" };

describe("eventListSchema",()=>{
  it("seleciona inscrições abertas quando a situação não é informada",()=>expect(eventListSchema.parse({status:""}).status).toBe("OPEN"));
  it("preserva a escolha explícita de visualizar todos",()=>expect(eventListSchema.parse({status:"ALL"}).status).toBe("ALL"));
});

describe("eventFormSchema",()=>{
  it("aceita um rascunho coerente",()=>{expect(eventFormSchema.safeParse(baseEvent).success).toBe(true);});
  it("rejeita término anterior ao início",()=>{const result=eventFormSchema.safeParse({...baseEvent,endsAt:"2027-08-19T18:00"});expect(result.success).toBe(false);});
  it("exige alvo para escopo regional",()=>{const result=eventFormSchema.safeParse({...baseEvent,eventScope:"REGION",regionId:""});expect(result.success).toBe(false);});
});

describe("registrationSchema",()=>{
  const base={eventId:"123e4567-e89b-12d3-a456-426614174000",participantKind:"VISITOR",memberId:"",regionId:"",congregationId:"",participantName:"Ana da Silva",participantGender:"FEMALE",participantPhone:"62999999999",preferredPaymentMethod:"PIX",items:[]};
  it("aceita uma inscrição simples de visitante",()=>expect(registrationSchema.safeParse(base).success).toBe(true));
  it("exige a seleção do cadastro no modo membro",()=>expect(registrationSchema.safeParse({...base,participantKind:"MEMBER",memberId:""}).success).toBe(false));
  it("aceita um cargo ativo representado por UUID",()=>expect(registrationSchema.safeParse({...base,participantRoleId:"123e4567-e89b-12d3-a456-426614174001"}).success).toBe(true));
  it("rejeita um identificador de cargo inválido",()=>expect(registrationSchema.safeParse({...base,participantRoleId:"cargo-invalido"}).success).toBe(false));
});

describe("registrationFieldSchema",()=>{
  const base={id:"",key:"nome_conjuge",kind:"CUSTOM",label:"Nome do cônjuge",helpText:"",type:"SHORT_TEXT",visibility:"OPTIONAL",options:[],sortOrder:160,active:true,systemLocked:false};
  it("aceita os tipos controlados de campo personalizado",()=>expect(registrationFieldSchema.safeParse(base).success).toBe(true));
  it("exige opções em uma seleção personalizada",()=>expect(registrationFieldSchema.safeParse({...base,type:"SINGLE_SELECT"}).success).toBe(false));
});

describe("expenseSchema",()=>{
  const base={id:"",eventId:"123e4567-e89b-12d3-a456-426614174000",name:"Aluguel do salão",expenseDate:"2026-08-27",amount:450,expectedUpdatedAt:"",receiptPath:"",receiptFileName:"",receiptMimeType:"",receiptFileSize:0};
  it("aceita uma despesa sem comprovante",()=>expect(expenseSchema.safeParse(base).success).toBe(true));
  it("rejeita valor zero e uma data inexistente",()=>{expect(expenseSchema.safeParse({...base,amount:0}).success).toBe(false);expect(expenseSchema.safeParse({...base,expenseDate:"2026-02-31"}).success).toBe(false);});
});

describe("publicRegistrationSchema",()=>{
  const base={eventId:"123e4567-e89b-12d3-a456-426614174000",participantKind:"VISITOR",congregationId:"",participantName:"Ana da Silva",participantGender:"FEMALE",participantPhone:"62999999999",participantRoleId:"",preferredPaymentMethod:"PIX",items:[]};
  it("não exige o checkbox de consentimento removido da interface",()=>expect(publicRegistrationSchema.safeParse(base).success).toBe(true));
});

describe("groupSchema",()=>{
  const base={eventId:"123e4567-e89b-12d3-a456-426614174000",groupId:"",expectedUpdatedAt:"",originChurchName:"Igreja Central",originFieldName:"",originCity:"Porangatu",originState:"GO",responsibleName:"Responsável",responsiblePhone:"62999999999",responsibleEmail:"",pastorName:"Pastor Local",pastorPhone:"",notes:"",totalRegistrations:100,maleCount:45,femaleCount:55,items:[{itemId:"123e4567-e89b-12d3-a456-426614174001",quantity:100}]};
  it("aceita uma caravana agregada sem nomes individuais",()=>expect(groupSchema.safeParse(base).success).toBe(true));
  it("exige que total seja masculino mais feminino",()=>expect(groupSchema.safeParse({...base,femaleCount:54}).success).toBe(false));
  it("exige controle de concorrência ao editar",()=>expect(groupSchema.safeParse({...base,groupId:"123e4567-e89b-12d3-a456-426614174002"}).success).toBe(false));
  it("aceita o fluxo público com pagamento parcial e arquivos opcionais",()=>expect(publicCaravanSchema.safeParse({...base,sessionKey:"caravan_123e4567-e89b-12d3-a456-426614174000",paymentMethod:"PIX",paymentAmount:2500,paymentReceiptPath:"church/events/event/public-caravans/session/receipt/file.pdf",paymentReceiptFileName:"comprovante.pdf",paymentReceiptMimeType:"application/pdf",paymentReceiptFileSize:1200}).success).toBe(true));
  it("não aceita valor público informado sem comprovante",()=>expect(publicCaravanSchema.safeParse({...base,sessionKey:"caravan_123e4567-e89b-12d3-a456-426614174000",paymentMethod:"PIX",paymentAmount:2500}).success).toBe(false));
});

describe("paymentStatusSchema",()=>{
  it("aceita o registro de pagamento não concluído",()=>expect(paymentStatusSchema.safeParse({paymentId:"123e4567-e89b-12d3-a456-426614174000",status:"FAILED",reason:"Transação recusada"}).success).toBe(true));
});

describe("publicPixPaymentSchema",()=>{
  const checkoutToken="a".repeat(48);
  it("aceita e normaliza CPF válido",()=>{const result=publicPixPaymentSchema.safeParse({checkoutToken,payerEmail:"pagador@exemplo.com",payerCpf:"529.982.247-25"});expect(result.success).toBe(true);if(result.success)expect(result.data.payerCpf).toBe("52998224725");});
  it("rejeita CPF ou e-mail inválidos",()=>expect(publicPixPaymentSchema.safeParse({checkoutToken,payerEmail:"inválido",payerCpf:"111.111.111-11"}).success).toBe(false));
});

const baseReportConfig = {
  filters: { regionId:"",congregationId:"",roleId:"",gender:"",registrationStatus:"",paymentMethod:"",paymentStatus:"",itemId:"",registeredFrom:"",registeredTo:"" },
  sections: { showSummary:true,showRegions:true,showCongregations:true,showRoles:false,showGenders:false,includeZeroCongregations:true,showAppliedFilters:true,showIssuedAt:true },
  columns: { regionalCoordinator:true,regionalQuota:true,regionalPercentage:true,congregationPastor:true,congregationQuota:true,congregationPercentage:true },
  organization:"BY_REGION",
};

describe("eventGeneralReportConfigSchema",()=>{
  it("aceita uma configuração completa",()=>expect(eventGeneralReportConfigSchema.safeParse(baseReportConfig).success).toBe(true));
  it("aceita somente a listagem opcional por cargos",()=>expect(eventGeneralReportConfigSchema.safeParse({...baseReportConfig,sections:{...baseReportConfig.sections,showSummary:false,showRegions:false,showCongregations:false,showRoles:true}}).success).toBe(true));
  it("aceita somente a listagem opcional por sexo",()=>expect(eventGeneralReportConfigSchema.safeParse({...baseReportConfig,sections:{...baseReportConfig.sections,showSummary:false,showRegions:false,showCongregations:false,showGenders:true}}).success).toBe(true));
  it("exige ao menos uma seção de dados",()=>expect(eventGeneralReportConfigSchema.safeParse({...baseReportConfig,sections:{...baseReportConfig.sections,showSummary:false,showRegions:false,showCongregations:false,showRoles:false,showGenders:false}}).success).toBe(false));
  it("rejeita intervalo de datas invertido",()=>expect(eventGeneralReportConfigSchema.safeParse({...baseReportConfig,filters:{...baseReportConfig.filters,registeredFrom:"2027-09-02",registeredTo:"2027-09-01"}}).success).toBe(false));
});

const baseParticipantReportConfig = {
  filters: baseReportConfig.filters,
  columns: { index:true,registrationNumber:false,role:true,gender:true,phone:false,registrationStatus:false,paymentMethod:false,paymentStatus:false,registeredAt:true,items:false },
  organization:"BY_REGION",
  showAppliedFilters:true,
  showIssuedAt:true,
};

describe("eventParticipantReportConfigSchema",()=>{
  it("aceita colunas opcionais e formato por regional",()=>expect(eventParticipantReportConfigSchema.safeParse(baseParticipantReportConfig).success).toBe(true));
  it("aceita todas as colunas opcionais desmarcadas",()=>expect(eventParticipantReportConfigSchema.safeParse({...baseParticipantReportConfig,columns:Object.fromEntries(Object.keys(baseParticipantReportConfig.columns).map((key)=>[key,false]))}).success).toBe(true));
  it("rejeita intervalo de datas invertido",()=>expect(eventParticipantReportConfigSchema.safeParse({...baseParticipantReportConfig,filters:{...baseParticipantReportConfig.filters,registeredFrom:"2027-09-02",registeredTo:"2027-09-01"}}).success).toBe(false));
});

const baseFinancialReportConfig = {
  scope:"GENERAL",
  filters: baseReportConfig.filters,
  expenseFilters:{name:"",from:"",to:""},
  sections: { showSummary:true,showPaymentMethods:true,showItems:true,showExpenses:true,showAppliedFilters:true,showIssuedAt:true },
  columns: { summaryExpectedAmount:false,summaryPendingAmount:false,summaryPaidRegistrationCount:true,paymentConfirmedCount:true,paymentPercentage:false,itemParticipantCount:true,itemExpectedAmount:true,expenseIndex:true,expenseReceipt:true },
  organization:"HIGHEST_VALUE",
  expenseOrganization:"DATE_DESC",
};

describe("eventFinancialReportConfigSchema",()=>{
  it("aceita as três seções financeiras",()=>expect(eventFinancialReportConfigSchema.safeParse(baseFinancialReportConfig).success).toBe(true));
  it("aceita somente o resumo financeiro",()=>expect(eventFinancialReportConfigSchema.safeParse({...baseFinancialReportConfig,sections:{...baseFinancialReportConfig.sections,showPaymentMethods:false,showItems:false,showExpenses:false}}).success).toBe(true));
  it("exige ao menos uma seção de dados",()=>expect(eventFinancialReportConfigSchema.safeParse({...baseFinancialReportConfig,sections:{...baseFinancialReportConfig.sections,showSummary:false,showPaymentMethods:false,showItems:false,showExpenses:false}}).success).toBe(false));
  it("rejeita intervalo de datas invertido",()=>expect(eventFinancialReportConfigSchema.safeParse({...baseFinancialReportConfig,filters:{...baseFinancialReportConfig.filters,registeredFrom:"2027-09-02",registeredTo:"2027-09-01"}}).success).toBe(false));
});
