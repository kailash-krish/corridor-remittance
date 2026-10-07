import Link from 'next/link';import {ChevronRight,House} from 'lucide-react';
export type Crumb={label:string;href?:string};
export default function Breadcrumbs({items}:{items:Crumb[]}){return <nav className="breadcrumbs" aria-label="Breadcrumb"><ol><li><Link href="/" aria-label="Home"><House size={13}/><span>Home</span></Link></li>{items.map((item,i)=><li key={`${item.label}-${i}`}><ChevronRight size={11} aria-hidden="true"/>{item.href&&i<items.length-1?<Link href={item.href}>{item.label}</Link>:<span aria-current={i===items.length-1?'page':undefined}>{item.label}</span>}</li>)}</ol></nav>}
