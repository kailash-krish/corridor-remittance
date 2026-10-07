const pageTitles:Record<string,string>={'/':'Corridor remittance overview','/privacy':'Corridor privacy policy','/terms':'Corridor terms and conditions'};
export function analyticsPage(path:string,origin:string){const pathname=path.split(/[?#]/)[0];if(!Object.hasOwn(pageTitles,pathname))return null;return{page_location:new URL(origin).origin+pathname,page_title:pageTitles[pathname],page_referrer:''};}
export function analyticsAllowed(id:string,consent:string,path:string){return /^G-[A-Z0-9]+$/.test(id)&&consent==='accepted'&&analyticsPage(path,'https://example.invalid')!==null;}
