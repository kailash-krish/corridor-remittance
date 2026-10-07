const deploymentHost=process.env.VERCEL_PROJECT_PRODUCTION_URL||process.env.VERCEL_URL;
export const siteUrl=process.env.NEXT_PUBLIC_SITE_URL||(deploymentHost?`https://${deploymentHost}`:'http://127.0.0.1:3100');
export const publicPaths=['/','/privacy','/terms'] as const;
export const faqs=[
 {q:'What can I try in this prototype?',a:'Create a quote, submit fictional identity details, start a transfer, simulate a deposit, and follow the backend-generated event trail. No real money is collected or paid out.'},
 {q:'How are the fee and exchange rate calculated?',a:'The demo charges a fixed AED 5 plus 0.5% of the sending amount. That fee is deducted before conversion. The backend supplies a simulated exchange rate and shows the exact INR amount before you confirm.'},
 {q:'Why does my quote expire after 60 seconds?',a:'A quote holds one simulated rate for a short window. If it expires before you confirm, request a fresh quote and review the updated recipient amount. An expired quote cannot start a transfer.'},
 {q:'Where does blockchain fit?',a:'The proposed architecture uses test tokens and escrow to represent and record value in transit. The default demo uses a chain adapter stub. The supplied smart contracts can run separately on a local test network, while fiat collection and INR payout remain simulated.'},
 {q:'Can I cancel a transfer or use real money?',a:'You can cancel a demo transfer while it is awaiting funds or in another eligible early state. Once processing advances, cancellation is unavailable. This hackathon prototype is not a licensed remittance service. Use fictional identities and recipient details only.'}
];
