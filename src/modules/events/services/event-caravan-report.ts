import type {EventCaravanReportConfig,EventCaravanReportRow,EventCaravanReportSource} from "../types/event.types";

export function organizeEventCaravans(rows:EventCaravanReportSource[],config:EventCaravanReportConfig):EventCaravanReportRow[]{
  const filtered=rows.filter((row)=>{
    if(config.filters.city&&row.city!==config.filters.city)return false;
    if(config.filters.state&&row.state!==config.filters.state)return false;
    if(config.filters.source&&row.source!==config.filters.source)return false;
    if(config.filters.paymentStatus&&row.paymentStatus!==config.filters.paymentStatus)return false;
    if(config.filters.registeredFrom&&row.registeredAt.slice(0,10)<config.filters.registeredFrom)return false;
    if(config.filters.registeredTo&&row.registeredAt.slice(0,10)>config.filters.registeredTo)return false;
    return true;
  });
  filtered.sort((first,second)=>config.organization==="HIGHEST_REGISTRATIONS"
    ?second.totalRegistrations-first.totalRegistrations||first.city.localeCompare(second.city,"pt-BR")||first.originChurch.localeCompare(second.originChurch,"pt-BR")
    :first.city.localeCompare(second.city,"pt-BR")||first.state.localeCompare(second.state,"pt-BR")||first.originChurch.localeCompare(second.originChurch,"pt-BR"));
  return filtered.map((row,index)=>({...row,index:index+1,cityAndState:`${row.city}/${row.state}`.toLocaleUpperCase("pt-BR")}));
}
