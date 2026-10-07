import type {Metadata} from 'next';import Landing from '@/components/remittance/landing';
export const metadata:Metadata={title:{absolute:'Corridor | Currency transfers, clearly explained'},description:'Explore transfers across ten currencies with dated reference rates, clear fees, a responsive globe, and a simulated transfer timeline.',alternates:{canonical:'/'}};
export default function Home(){return <Landing/>}
