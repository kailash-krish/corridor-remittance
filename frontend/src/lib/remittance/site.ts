const deploymentHost=process.env.VERCEL_PROJECT_PRODUCTION_URL||process.env.VERCEL_URL;
export const siteUrl=process.env.NEXT_PUBLIC_SITE_URL||(deploymentHost?`https://${deploymentHost}`:'http://127.0.0.1:3100');
export const publicPaths=['/','/privacy','/terms'] as const;
export const faqs=[
 {q:'What can I try in this prototype?',a:'Create a quote, submit fictional identity details, start a transfer, simulate a deposit, and follow the backend-generated event trail. No real money is collected or paid out.'},
 {q:'How are the fee and exchange rate calculated?',a:'The fee is a currency-specific fixed amount plus 0.5%, shown before confirmation. Rates come from Frankfurter’s daily reference data, with the observation date displayed. They are not intraday or executable bank rates.'},
 {q:'Why does my quote expire after 60 seconds?',a:'A quote holds one reference rate for a short window. If it expires before you confirm, request a fresh quote and review the updated recipient amount. An expired quote cannot start a transfer.'},
 {q:'Where does blockchain fit?',a:'The proposed architecture uses test tokens and escrow to represent and record value in transit. The default demo uses a chain adapter stub. The supplied smart contracts can run separately on a local test network, while fiat collection and local-currency payout remain simulated.'},
 {q:'Can I cancel a transfer or use real money?',a:'You can cancel a demo transfer while it is awaiting funds or in another eligible early state. Once processing advances, cancellation is unavailable. This hackathon prototype is not a licensed remittance service. Use fictional identities and recipient details only.'}
];
