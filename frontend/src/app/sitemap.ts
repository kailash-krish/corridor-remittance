import type {MetadataRoute} from 'next';import {siteUrl,publicPaths} from '@/lib/remittance/site';
export default function sitemap():MetadataRoute.Sitemap{return publicPaths.map(path=>({url:`${siteUrl}${path==='/'?'':path}`,changeFrequency:path==='/'?'monthly':'yearly',priority:path==='/'?1:.3}))}
