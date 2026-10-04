export function financeLocation(path:string,unit:string,month:string){
 return path.startsWith("/financeiro")?`${path}?${new URLSearchParams({unidade:unit,mes:month})}`:path;
}
