# Imyanya Tickets

**Live:** https://tickets.imyanya.rw

## Project Description - Imyanya Tickets

Imyanya Tickets is a modern online event ticketing platform under [Imyanya.rw](https://imyanya.rw), designed to help event organizers create, manage, promote, and sell tickets online while giving customers a simple way to discover events, purchase tickets, and receive secure digital tickets.

The platform supports concerts, conferences, sports events, festivals, parties, workshops, and other paid events. Customers can select ticket types or seats, pay securely online, and receive a digital ticket containing a unique QR code through WhatsApp and email.

Organizers have a dedicated dashboard to create events, manage ticket categories and prices, monitor sales, manage attendees, and validate tickets at the venue using QR-code scanning.

**Main domain:** https://tickets.imyanya.rw

**Tagline:** Discover. Buy. Pay. Get Your Ticket.

## Core Features

- Event discovery and search
- Organizer registration and dashboard
- Event creation and management
- Multiple ticket types and pricing
- Seat selection where applicable
- Online payments
- Order and payment management
- QR-code ticket generation
- PDF digital tickets
- WhatsApp and email ticket delivery
- QR-code check-in and ticket validation
- Sales and attendance analytics
- Promo codes and discounts
- Refund and cancellation management
- Secure authentication and role-based access
- Mobile-first responsive design
- API-based architecture for future integrations

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Next.js 16](https://nextjs.org/) (App Router, React 19, React Compiler) |
| Language | [TypeScript](https://www.typescriptlang.org/) |
| Database | [PostgreSQL](https://www.postgresql.org/) + [Drizzle ORM](https://orm.drizzle.team/) |
| Auth | [Better Auth](https://www.better-auth.com/) (sessions, OAuth) |
| AI | [Vercel AI SDK](https://sdk.vercel.ai/) + OpenAI |
| Email | [Resend](https://resend.com/) |
| Uploads | [Uploadthing](https://uploadthing.com/) |
| Cache | [Upstash Redis](https://upstash.com/) |
| UI | [shadcn/ui](https://ui.shadcn.com/) + [Tailwind CSS](https://tailwindcss.com/) |
| Linting | [Biome](https://biomejs.dev/) |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [PostgreSQL](https://www.postgresql.org/) database
- [Bun](https://bun.sh/) (recommended) or npm

### 1. Install dependencies

```bash
bun install
```

### 3. Set up environment variables

```bash
cp .env.example .env.local
```

Fill in your credentials in `.env.local`:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | Yes | Random secret for session signing |
| `BETTER_AUTH_URL` | Yes | App URL (`http://localhost:3000` for dev) |
| `NEXT_PUBLIC_APP_URL` | Yes | Public app URL |
| `OPENAI_API_KEY` | Yes | OpenAI API key for the AI agent |
| `GOOGLE_CLIENT_ID` | No | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | No | Google OAuth client secret |
| `UPSTASH_REDIS_REST_URL` | Yes | Upstash Redis URL for rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | Yes | Upstash Redis token |
| `RESEND_API_KEY` | Yes | Resend API key for emails |
| `UPLOADTHING_TOKEN` | Yes | Uploadthing token for file uploads |

### 4. Set up the database

```bash
# Generate migrations from the schema
bun run db:generate

# Apply migrations
bun run db:migrate
```

### 5. Run the development server

```bash
bun dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
imyanya-tickets/
├── app/
│   ├── (dashboard)/         # Authenticated host/attendee pages
│   │   └── dashboard/
│   │       └── events/[eventId]/
│   ├── (public)/            # Public-facing pages
│   │   ├── events/          # Event discovery & detail
│   │   └── u/               # User profiles
│   ├── api/
│   │   ├── auth/            # Better Auth endpoints
│   │   ├── chat/            # AI agent endpoint
│   │   └── events/          # Event API routes
│   └── ticket/              # Ticket & QR code pages
├── components/              # Shared UI components (shadcn/ui)
├── lib/
│   ├── ai/
│   │   └── agents/
│   │       ├── orchestrator.ts   # Main AI agent (routes requests)
│   │       └── event-agent.ts    # Event operations (10 tools)
│   ├── db/
│   │   └── schema.ts        # Drizzle database schema
│   ├── auth.ts              # Better Auth config
│   └── email.ts             # Email templates (Resend)
├── actions/                 # Server actions
├── hooks/                   # Custom React hooks
├── providers/               # Context providers
└── public/                  # Static assets
```

## AI Agent Architecture

Imyanya Tickets uses a **multi-agent delegation pattern** powered by the Vercel AI SDK:

```
User Message
    │
    ▼
┌──────────────┐
│ Orchestrator  │  Routes requests to specialized agents
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Event Agent   │  Handles all event operations
└──────────────┘
```

The **Event Agent** has access to these tools:

| Tool | Description |
|------|-------------|
| `getCurrentDate` | Resolves relative dates ("next Friday") |
| `createEvent` | Creates events with full validation |
| `listMyEvents` | Lists the user's hosted events |
| `searchEvents` | Searches public events by title/date |
| `getEventDetails` | Retrieves full event info with attendees |
| `editEvent` | Updates event details (host/cohost only) |
| `deleteEvent` | Deletes events with confirmation flow |
| `submitRsvp` | Handles RSVP submission |
| `getAttendees` | Lists attendees grouped by status |
| `sendInvitation` | Sends email invitations with tokens |

## Available Scripts

```bash
bun dev             # Start development server
bun run build       # Build for production
bun run start       # Start production server
bun run lint        # Run Biome linter
bun run format      # Format code with Biome
bun run db:generate # Generate Drizzle migrations
bun run db:migrate  # Run database migrations
bun run db:push     # Push schema changes directly
bun run db:studio   # Open Drizzle Studio (database GUI)
```

## Database Schema

The core data model:

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│  users   │────▶│  events  │◀────│   rsvps  │
└──────────┘     └──────────┘     └──────────┘
                       │
            ┌──────────┼──────────┐
            ▼          ▼          ▼
     ┌───────────┐ ┌────────┐ ┌─────────────┐
     │invitations│ │  tags  │ │  cohosts    │
     └───────────┘ └────────┘ └─────────────┘
```

- **events** — Title, description, location, capacity, visibility, type, approval settings
- **rsvps** — Status workflow: pending -> approved / rejected / waitlisted
- **invitations** — Token-based email invitations with 7-day expiry
- **eventCohosts** — Co-host delegation
- **attendeeCheckins** — Check-in audit trail

## Deployment

Imyanya Tickets can be deployed to any platform that supports Next.js:

- **[Vercel](https://vercel.com)** — Zero-config deployment (recommended)
- **[Railway](https://railway.app)** — Full-stack with managed PostgreSQL
- **Docker** — Self-hosted (Dockerfile coming soon)

Make sure to set all environment variables from `.env.example` in your deployment platform.

## Contributing

Contributions are welcome! Here's how to get started:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Run linting: `bun run lint`
5. Commit your changes: `git commit -m "feat: add my feature"`
6. Push to your fork: `git push origin feature/my-feature`
7. Open a Pull Request

## License

This project is licensed under the [MIT License](LICENSE).

## Acknowledgements

- Inspired by [Lu.ma](https://lu.ma)
- Built with [Next.js](https://nextjs.org/), [Vercel AI SDK](https://sdk.vercel.ai/), [shadcn/ui](https://ui.shadcn.com/)
