export type { FinanceCatalogMutation } from "../validations/finance-catalog.schemas";
export type CatalogItem={id:string;name:string;status:string};
export type Department=CatalogItem&{baseVersions:{id:string;effectiveMonth:string;revision:number;participatesInBase:boolean}[]};
export type Category=CatalogItem&{direction:string;departmentId:string|null;isTithe:boolean;isOffering:boolean;requiresPerson:boolean};
export type Classification=CatalogItem&{roleId:string|null};
export type PaymentMethod=CatalogItem&{kind:string};
export type Cashbox=CatalogItem&{congregationId:string;kind:string;openingDate:string|null;openingCents:number;balanceCents:number;paymentMethodIds:string[];bankName:string|null;agency:string|null;accountNumber:string|null};
export type FinanceCatalogs={departments:Department[];categories:Category[];classifications:Classification[];paymentMethods:PaymentMethod[];cashboxes:Cashbox[]};
