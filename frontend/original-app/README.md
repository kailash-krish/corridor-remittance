# UI Design & Components Package

This directory contains the **complete UI / Frontend design system** for the **Trader Invoice Mailer** application.

> **Note**: This package is **strictly frontend UI**. All backend endpoints (`/api`), Supabase auth/database connections, SQL migrations, AI engines, server actions, and environment secrets (`.env`) have been completely excluded.

---

## 📁 Directory Structure

```text
UI/
├── package.json                   # Frontend dependencies (React, Next, Tailwind, Radix, Lucide)
├── tsconfig.json                  # TypeScript config with @/* path aliases
├── tailwind.config.js             # Theme tokens, HSL colors, animations, dark mode
├── postcss.config.js              # PostCSS config
├── components.json                # shadcn UI config
├── next.config.js                 # Next.js configuration
├── README.md                      # This documentation
│
└── src/
    ├── UI/                        # Custom Application Components
    │   ├── dashboard-sidebar.tsx  # Collapsible sidebar, navigation shell & mobile drawer
    │   ├── dropdown-menu.tsx      # Smooth animated dropdown menu
    │   ├── login-form.tsx         # Multi-mode auth form (login, signup, forgot password)
    │   ├── multi-step-form.tsx    # Multi-step wizard container with step progression
    │   ├── smokey-background.tsx  # Interactive canvas smoke effect
    │   └── text-type.tsx          # Animated typing text component
    │
    ├── components/
    │   └── ui/                    # Core UI Primitives & Design System
    │       ├── button.tsx         # Button component (variants: primary, outline, ghost, destructive)
    │       ├── card.tsx           # Card container, header, content, and footer
    │       ├── dialog.tsx         # Modal dialog with backdrop and accessibility
    │       ├── elegant-dark-pattern.tsx # Radial background gradient pattern
    │       ├── glide-select.tsx   # Custom animated wheel selection control
    │       ├── glide-select.css   # Styles for glide select
    │       └── progress.tsx       # Animated progress bar
    │
    ├── lib/
    │   ├── utils.ts               # cn() helper, Indian Rupee/Paise formatting, date formatting
    │   ├── types/
    │   │   └── index.ts           # TypeScript interfaces (Invoice, Track, EmailDraft, Status)
    │   ├── api.ts                 # Standalone mock API with in-memory sample data
    │   └── auth/
    │       └── actions.ts         # Mock auth actions (login/signup handlers)
    │
    └── app/
        ├── globals.css            # Global CSS variables, HSL color tokens, dark mode styles
        ├── layout.tsx             # Root layout with typography and metadata
        ├── page.tsx               # Marketing landing page with hero, features & CTA
        │
        ├── login/                 # Login page view & client component
        ├── signup/                # Signup page view & client component
        ├── forgot-password/       # Forgot password view & client component
        │
        └── dashboard/             # Dashboard Views
            ├── layout.tsx         # Dashboard shell layout
            ├── page.tsx           # Dashboard home with KPI cards & recent invoices
            ├── shell-client.tsx   # Interactive sidebar wrapper
            ├── new/               # Multi-step invoice creation wizard
            ├── invoices/          # Invoices table with status tabs, search & filters
            │   ├── invoice-edit-dialog.tsx # Invoice editing modal dialog
            │   └── [id]/          # Invoice detail view & email draft preview
            ├── tracks/            # Trading segment list & audit activity timeline
            └── settings/          # User profile, notifications, and security settings
```

---

## 🎨 Theme & Styling System

The application uses **Tailwind CSS** with custom dark-mode HSL color tokens defined in `src/app/globals.css`:

- **Primary Accent**: Cyan / Electric Blue (`--primary: 190 100% 45%`)
- **Background**: Deep charcoal / obsidian (`--background: 0 0% 2%`)
- **Card Surfaces**: Translucent dark glass (`--card: 205 35% 8% / 0.78`)
- **Status Colors**:
  - Open: Blue (`--status-open`)
  - In Progress: Amber (`--status-progress`)
  - Closed: Emerald (`--status-closed`)
  - Overdue: Rose (`--status-overdue`)

---

## 🚀 How to Run & Preview Standalone

To run and preview this UI independently:

1. Open your terminal in this `UI` folder:
   ```bash
   cd UI
   ```
2. Install the frontend dependencies:
   ```bash
   npm install
   ```
3. Start the Next.js dev server:
   ```bash
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000) in your browser.
   - `/` - Landing Page
   - `/login` - Login Form
   - `/signup` - Sign Up Form
   - `/dashboard` - Overview & Stats
   - `/dashboard/invoices` - Invoices Table & Search
   - `/dashboard/invoices/inv-001` - Invoice Detail & AI Draft View
   - `/dashboard/new` - Multi-Step Create Invoice Wizard
   - `/dashboard/tracks` - Activity & Trading Tracks
   - `/dashboard/settings` - Settings Screen

All tables, modals, search inputs, tabs, and action buttons work interactively with built-in mock data!
