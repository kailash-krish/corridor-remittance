import currencies from './currencies.json';
export {currencies};
export const currency=(code:string)=>currencies.find(c=>c.code===code)||currencies[0];
export function money(minor:number,code='AED'){const c=currency(code);return new Intl.NumberFormat(code==='INR'?'en-IN':'en-GB',{style:'currency',currency:code,currencyDisplay:'code',minimumFractionDigits:c.decimals,maximumFractionDigits:c.decimals}).format(minor/10**c.decimals)}
export function toMinor(value:string,code:string):number|null{const decimals=currency(code).decimals;if(!/^\d+(?:\.\d+)?$/.test(value))return null;const [whole,fraction='']=value.split('.');if(fraction.length>decimals)return null;const n=Number(whole)*10**decimals+Number(fraction.padEnd(decimals,'0'));return Number.isSafeInteger(n)&&n>0&&n<=1000000*10**decimals?n:null}
export type Quote={id:string;source_currency:string;target_currency:string;send_amount_minor:number;receive_amount_minor:number;fee_minor:number;exchange_rate:number;expires_at:string;rate_provider?:string;rate_date?:string};
