import type {Metadata} from 'next';import Login from '@/components/remittance/login';
export const metadata:Metadata={title:'Log in to your demo workspace',description:'Start a signed Corridor demo session to explore multi-currency quotes, test identity checks, and simulated transfers.',robots:{index:false,follow:true},alternates:{canonical:'/login'}};
export default function Page(){return <Login/>}
