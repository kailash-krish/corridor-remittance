import type {Metadata} from 'next';import Workspace from '@/components/remittance/workspace';
export const metadata:Metadata={title:'Send money from the Cross-border transfers',description:'Get an multi-currency demo quote, review recipient details, and track every stage of your simulated transfer.',robots:{index:false,follow:false},alternates:{canonical:'/dashboard'}};
export default function Dashboard(){return <Workspace/>}
