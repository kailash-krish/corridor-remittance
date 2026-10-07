'use client';
import {ArrowRight} from 'lucide-react';
import {currencies} from '@/lib/remittance/currency';
export default function CurrencySelectors({source,target,onChange,disabled=false}:{source:string;target:string;onChange:(source:string,target:string)=>void;disabled?:boolean}){
 return <div className="currency-selectors"><label>You send in<select aria-label="Sending currency" value={source} disabled={disabled} onChange={e=>onChange(e.target.value,e.target.value===target?source:target)}>{currencies.map(c=><option key={c.code} value={c.code}>{c.code} · {c.name}</option>)}</select></label><ArrowRight size={17} aria-hidden="true"/><label>They receive in<select aria-label="Recipient currency" value={target} disabled={disabled} onChange={e=>onChange(e.target.value===source?target:source,e.target.value)}>{currencies.map(c=><option key={c.code} value={c.code}>{c.code} · {c.name}</option>)}</select></label></div>
}
