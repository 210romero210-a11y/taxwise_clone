# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **TaxWise Clone** - a modern fullstack tax preparation application built with Next.js 16 (App Router), Convex (backend/database), and Tailwind CSS. It replicates legacy tax software functionality using a metadata-driven form engine with IRS form definitions stored as JSON blueprints.

## Common Commands

```bash
# Start development (runs both frontend and backend)
npm run dev

# Run only frontend
npm run dev:frontend

# Run only backend (Convex)
npm run dev:backend

# Build for production
npm run build

# Lint code
npm run lint

# Run tests
npm run test
```

## Architecture

### Tech Stack
- **Frontend**: Next.js 16 with App Router, React 19, Tailwind CSS 4
- **Backend**: Convex (database, server functions, real-time subscriptions)
- **Testing**: Jest with ts-jest
- **AI/OCR**: Vercel AI SDK, OpenAI, Ollama for local models
- **Auth**: WorkOS AuthKit with Clerk integration pattern

### Four-Layer Architecture

1. **Client Layer** (`app/`, `components/`)
   - Next.js App Router pages and layouts
   - React Server Components (RSC) for data streaming
   - Dynamic form rendering components

2. **Schema Layer** (`convex/formDefinitions.ts`, `convex/fieldDefinitions.ts`, `convex/validationRules.ts`, `convex/mappingEngine.ts`)
   - JSON blueprints for IRS forms (1040, W2, SchC, K-1, etc.)
   - Cross-form field mapping engine
   - Validation rules with IRS error code mapping

3. **Data Layer** (Convex tables in `convex/schema.ts`)
   - `returns` - Tax return metadata
   - `formInstances` - Individual form instances per return
   - `fields` - Field values (Box1, Line1z, etc.)
   - `taxTotals` - Running totals for incremental calculation
   - `lifecycleStatus` - Filing status tracking

4. **Entity Lifecycle Layer** (`convex/calculations.ts`, `convex/k1Records.ts`)
   - Entity-type-specific logic (Individual, Business, Specialty)
   - K-1 pass-through data synchronization
   - Tax calculations

### Key Convex Patterns

- Use `query`, `mutation`, `action` decorators for public functions
- Use `internalQuery`, `internalMutation`, `internalAction` for private functions
- Always include argument validators using `v` from `convex/values`
- Schema defined in `convex/schema.ts` using `defineSchema` and `defineTable`
- Function references use `api.filename.functionName` pattern

### IRS Compliance Features

- **MeF Engine**: Modernized e-File transmission with XML payloads
- **Immutable Audit Logs**: Cryptographically chained audit trail
- **Bilingual Support**: EN/ES translations via `translations` table
- **MFA**: IRS Publication 1345 compliant authentication
- **Session Security**: 15-min timeout, 12-hr re-authentication

## Project Structure

```
taxwise_clone/
├── app/                    # Next.js App Router pages
├── components/             # React components
├── convex/                 # Convex backend functions
│   ├── schema.ts          # Database schema
│   ├── calculations.ts     # Tax calculation logic
│   ├── formDefinitions.ts # IRS form blueprints
│   ├── fieldDefinitions.ts# Field metadata
│   ├── validationRules.ts # Business rules
│   ├── mappingEngine.ts   # Cross-form mapping
│   └── *_test.ts          # Unit tests
├── lib/                    # Utilities
├── plans/                  # Implementation planning docs
└── styles/                 # Global styles
```
