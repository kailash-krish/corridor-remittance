import type {Metadata} from 'next';import Landing from '@/components/remittance/landing';
export const metadata:Metadata={title:{absolute:'Corridor | AED to INR remittances, clearly explained'},description:'Explore a clearer UAE-to-India remittance journey. See fees upfront, follow a simulated transfer, and understand how value moves from AED to INR.',alternates:{canonical:'/'}};
export default function Home(){return <Landing/>}
