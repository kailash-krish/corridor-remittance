import currencies from "../config/currencies.json";
import {AppError, BadRequestError} from "../utils/errors.js";
export {currencies};
export const getCurrency = (code: string) => {
  const item = currencies.find(c => c.code === code.toUpperCase());
  if (!item) throw new BadRequestError(`Unsupported currency: ${code}`);
  return item;
};
const URL = 'https://api.frankfurter.dev/v2/rates?base=USD&quotes=' + currencies.filter(c=>c.code!=='USD').map(c=>c.code).join(',');
type Row = {base:string;quote:string;date:string;rate:number};
type Snapshot = {rates:Record<string,number>;dates:Record<string,string>;fetchedAt:number};
const unavailable = () => new AppError('Current reference rates are unavailable. Please try again shortly.',503,'FX_UNAVAILABLE');
export class ReferenceRates {
  private cached?:Snapshot;
  private pending?:Promise<Snapshot>;
  constructor(private fetcher:typeof fetch = (...args)=>fetch(...args), private clock=()=>Date.now()) {}
  async latest():Promise<Snapshot> {
    if(this.cached && this.clock()-this.cached.fetchedAt<3600000) return this.cached;
    if(this.pending) return this.pending;
    this.pending=this.load().finally(()=>{this.pending=undefined});
    return this.pending;
  }
  private async load():Promise<Snapshot> {
    try {
      const response=await this.fetcher(URL,{signal:AbortSignal.timeout(8000)});
      if(!response.ok) throw unavailable();
      const data:unknown=await response.json();
      if(!Array.isArray(data)) throw unavailable();
      const rates:Record<string,number>={USD:1},dates:Record<string,string>={};
      for(const value of data){
        const r=value as Row;
        if(r.base!=='USD'||!currencies.some(c=>c.code===r.quote)||r.quote==='USD'||rates[r.quote]!==undefined||!Number.isFinite(r.rate)||r.rate<=0||r.rate>1000000||!/^\d{4}-\d{2}-\d{2}$/.test(r.date)) throw unavailable();
        const age=this.clock()-Date.parse(r.date+'T00:00:00Z');
        if(!Number.isFinite(age)||age>7*86400000||age < -86400000) throw unavailable();
        rates[r.quote]=r.rate;dates[r.quote]=r.date;
      }
      if(currencies.some(c=>!rates[c.code])) throw unavailable();
      dates.USD=Object.values(dates).sort()[0];
      this.cached={rates,dates,fetchedAt:this.clock()};
      return this.cached;
    } catch {throw unavailable()}
  }
}
export const referenceRates=new ReferenceRates();
// Integer arithmetic prevents zero/three-decimal currencies from inheriting a 100x scale.
export function convertMinor(amount:number,rate:number,fromDecimals:number,toDecimals:number):number {
  const scale=1000000000000n;
  const numerator=BigInt(amount)*BigInt(Math.round(rate*Number(scale)))*10n**BigInt(toDecimals);
  const denominator=scale*10n**BigInt(fromDecimals);
  const result=Number((numerator+denominator/2n)/denominator);
  if(!Number.isSafeInteger(result)||result<0)throw new BadRequestError('Converted amount is outside the supported range.');
  return result;
}
export class FxService {
  constructor(private provider=referenceRates){}
  async calculateQuote(sourceCurrency:string,targetCurrency:string,sendAmountMinor:number){
    const source=getCurrency(sourceCurrency),target=getCurrency(targetCurrency);
    if(source.code===target.code)throw new BadRequestError('Choose two different currencies.');
    if(!Number.isSafeInteger(sendAmountMinor)||sendAmountMinor<=0||sendAmountMinor>1000000*10**source.decimals)throw new BadRequestError('Enter a valid amount of no more than 1,000,000 source currency units.');
    const feeMinor=source.flatFeeMinor+Math.floor((sendAmountMinor+100)/200);
    if(sendAmountMinor<=feeMinor)throw new BadRequestError('The sending amount must exceed the transfer fee.');
    const snapshot=await this.provider.latest();
    const exchangeRate=Number((snapshot.rates[target.code]/snapshot.rates[source.code]).toFixed(12));
    const receiveAmountMinor=convertMinor(sendAmountMinor-feeMinor,exchangeRate,source.decimals,target.decimals);
    if(receiveAmountMinor<1)throw new BadRequestError('Increase the amount so the recipient receives at least one minor currency unit.');
    return {sourceCurrency:source.code,targetCurrency:target.code,sendAmountMinor,feeMinor,netConvertibleMinor:sendAmountMinor-feeMinor,exchangeRate,receiveAmountMinor,
      rateProvider:'Frankfurter',rateDate:[snapshot.dates[source.code],snapshot.dates[target.code]].sort()[0],
      sendAedMinor:convertMinor(sendAmountMinor,snapshot.rates.AED/snapshot.rates[source.code],source.decimals,2)};
  }
}
export const fxService=new FxService();
