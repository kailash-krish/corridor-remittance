import type {MetadataRoute} from 'next';import {siteUrl} from '@/lib/remittance/site';
export default function robots():MetadataRoute.Robots{return{rules:{userAgent:'*',allow:'/',disallow:['/api/','/dashboard','/login']},sitemap:`${siteUrl}/sitemap.xml`}}
