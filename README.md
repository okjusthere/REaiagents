# REscript

REscript generates daily real estate video scripts for selected US markets, sends them by email, and gates viewer access with signed links.

## Current capabilities

- Google News RSS ingestion for 8 US real estate markets
- Bilingual generation (`zh` / `en`) with 4 script styles per topic
- Daily output isolation by `date + language + market`
- Private viewer links per recipient instead of public date-based access
- Trial, paid subscription, manage-subscription, and Stripe billing portal flows
- Admin dashboard for clients, runs, and historical output inspection

## Run locally

```bash
npm install
cp .env.example .env
npm run build
npm run dry-run
```

For a full local server:

```bash
npm start
```

## Required environment variables

| Variable | Purpose |
| --- | --- |
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI endpoint |
| `AZURE_OPENAI_API_KEY` | Azure OpenAI API key |
| `AZURE_OPENAI_DEPLOYMENT` | Azure deployment/model name |
| `EMAIL_PROVIDER` | `resend` or `gmail` |
| `ADMIN_TOKEN` | Admin API bearer token |
| `BASE_URL` | Public app URL used in email links |

## Optional environment variables

| Variable | Purpose |
| --- | --- |
| `RESEND_API_KEY` | Resend API key when `EMAIL_PROVIDER=resend` |
| `EMAIL_FROM_ADDRESS` | Verified sender address when `EMAIL_PROVIDER=resend` |
| `GMAIL_USER` | SMTP sender inbox when `EMAIL_PROVIDER=gmail` |
| `GMAIL_APP_PASSWORD` | Gmail app password when `EMAIL_PROVIDER=gmail` |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook secret |
| `STRIPE_PRICE_ID` | Stripe subscription price ID |
| `SUPPORT_EMAIL` | Reply-to and support address |
| `COMPANY_ADDRESS` | Footer mailing address |
| `VIEWER_TOKEN_SECRET` | Secret for signed viewer/manage links |
| `CRON_SCHEDULE` | Cron schedule, default `0 7 * * *` |
| `CRON_TIMEZONE` | Cron timezone, default `America/New_York` |
| `DRY_RUN` | `true` to skip actual email sends |
| `LOG_LEVEL` | Winston log level |

## Main entry points

- [src/index.ts](/Users/weizhengle/Downloads/vibecoding/REaiagents/src/index.ts)
- [src/orchestrator.ts](/Users/weizhengle/Downloads/vibecoding/REaiagents/src/orchestrator.ts)
- [src/web/server.ts](/Users/weizhengle/Downloads/vibecoding/REaiagents/src/web/server.ts)
- [src/web/stripe-api.ts](/Users/weizhengle/Downloads/vibecoding/REaiagents/src/web/stripe-api.ts)
- [public/subscribe.html](/Users/weizhengle/Downloads/vibecoding/REaiagents/public/subscribe.html)
- [public/manage.html](/Users/weizhengle/Downloads/vibecoding/REaiagents/public/manage.html)

## Notes

- Generated content still requires human review before publication, especially for legal, tax, fair housing, MLS, or brokerage-sensitive claims.
- `public/privacy.html` and `public/terms.html` are baseline product pages and should still be reviewed by counsel before launch.
- In `resend` mode, the app sends mail through the Resend API only. In `gmail` mode, it uses Gmail SMTP only. The dual-provider support is for rollout and fallback, not simultaneous delivery.
