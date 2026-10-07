import type { Metadata } from 'next';
import '@fontsource/outfit/400.css';
import '@fontsource/outfit/500.css';
import '@fontsource/outfit/600.css';
import './globals.css';
import Analytics from '@/components/remittance/analytics';
import {siteUrl} from '@/lib/remittance/site';
export const metadata: Metadata = {
 metadataBase:new URL(siteUrl),
 title:{default:'Corridor | AED to INR remittances',template:'%s | Corridor'},
 description:'Explore a transparent UAE-to-India remittance prototype with clear fees, simulated transfers, and a traceable journey.',
 applicationName:'Corridor',
 openGraph:{type:'website',locale:'en_IN',siteName:'Corridor',title:'Corridor | Send dirhams. They receive rupees.',description:'A clearer AED-to-INR transfer journey, from quote to payout.'},
 twitter:{card:'summary_large_image',title:'Corridor | UAE to India',description:'Clear fees. Traceable transfers. Explore the remittance prototype.'},
 icons:{icon:'/icon.svg',apple:'/apple-icon.png'},
};
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="en"><body><a className="skip-link" href="#main-content">Skip to content</a><div id="main-content" tabIndex={-1}>{children}</div><Analytics/></body></html>}
