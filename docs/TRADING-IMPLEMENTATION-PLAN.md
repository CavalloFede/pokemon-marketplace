# Trading System Implementation Plan

## Overview

Implement a "Want Listings" trading system where users can:
1. Post a "want" listing (e.g., "Want Pikachu") with a starting offer (coins or Pokemon)
2. Other users can accept the offer directly OR make a counter-offer
3. Counter-offers can request more coins or specific Pokemon
4. Original poster can accept/reject counter-offers

---

## Database Schema

### New Tables

```prisma
model WantListing {
  id              String           @id @default(uuid())
  userId          String
  user            User             @relation(fields: [userId], references: [id])

  // What the user wants
  wantedSpeciesId Int              // The Pokemon species they want
  wantedSpecies   Species          @relation("WantedSpecies", fields: [wantedSpeciesId], references: [id])
  wantShiny       Boolean          @default(false)

  // Initial offer
  coinsOffered    Int              @default(0)

  // Status
  status          WantListingStatus @default(OPEN)

  // Timestamps
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt
  expiresAt       DateTime?

  // Relations
  offeredPokemon  WantListingPokemon[]
  counterOffers   CounterOffer[]

  @@index([userId])
  @@index([wantedSpeciesId])
  @@index([status])
}

model WantListingPokemon {
  id            String      @id @default(uuid())
  wantListingId String
  wantListing   WantListing @relation(fields: [wantListingId], references: [id], onDelete: Cascade)
  pokemonId     String
  pokemon       Pokemon     @relation(fields: [pokemonId], references: [id])

  @@unique([wantListingId, pokemonId])
}

model CounterOffer {
  id              String             @id @default(uuid())
  wantListingId   String
  wantListing     WantListing        @relation(fields: [wantListingId], references: [id], onDelete: Cascade)
  userId          String             // User making the counter-offer
  user            User               @relation(fields: [userId], references: [id])

  // What they're offering (the wanted Pokemon)
  offeredPokemonId String            // The actual Pokemon instance they'll trade
  offeredPokemon   Pokemon           @relation("CounterOfferPokemon", fields: [offeredPokemonId], references: [id])

  // What they want in return (can differ from original offer)
  coinsRequested   Int               @default(0)

  // Message
  message          String?

  // Status
  status           CounterOfferStatus @default(PENDING)

  // Timestamps
  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt

  // Pokemon they want in addition to/instead of coins
  requestedPokemon CounterOfferRequestedPokemon[]

  @@index([wantListingId])
  @@index([userId])
  @@index([status])
}

model CounterOfferRequestedPokemon {
  id             String       @id @default(uuid())
  counterOfferId String
  counterOffer   CounterOffer @relation(fields: [counterOfferId], references: [id], onDelete: Cascade)
  pokemonId      String       // Specific Pokemon from the listing owner they want
  pokemon        Pokemon      @relation(fields: [pokemonId], references: [id])

  @@unique([counterOfferId, pokemonId])
}

enum WantListingStatus {
  OPEN
  COMPLETED
  CANCELLED
  EXPIRED
}

enum CounterOfferStatus {
  PENDING
  ACCEPTED
  REJECTED
  WITHDRAWN
}
```

---

## Tasks

### Phase 1: Database Setup

#### Task 1.1: Create Prisma Migration for WantListing
**File:** `apps/api/prisma/schema.prisma`

**Changes:**
- Add `WantListing` model
- Add `WantListingPokemon` model (for offered Pokemon in listing)
- Add `WantListingStatus` enum
- Add relation to `User` model
- Add relation to `Species` model

**Verification:**
- [ ] Run `pnpm prisma generate` without errors
- [ ] Run `pnpm prisma db push` without errors

---

#### Task 1.2: Create Prisma Migration for CounterOffer
**File:** `apps/api/prisma/schema.prisma`

**Changes:**
- Add `CounterOffer` model
- Add `CounterOfferRequestedPokemon` model
- Add `CounterOfferStatus` enum
- Add relations to `WantListing`, `User`, `Pokemon`

**Verification:**
- [ ] Run `pnpm prisma generate` without errors
- [ ] Run `pnpm prisma db push` without errors

---

### Phase 2: Backend API - Want Listings

#### Task 2.1: Create Want Listing Service
**File:** `apps/api/src/services/want-listing.service.ts`

**Functions to implement:**
```typescript
class WantListingService {
  // Create a new want listing
  async createListing(userId: string, data: {
    wantedSpeciesId: number;
    wantShiny?: boolean;
    coinsOffered: number;
    offeredPokemonIds: string[];
    expiresInDays?: number;
  }): Promise<WantListing>

  // Get all open listings (with filters)
  async getListings(params: {
    speciesId?: number;
    minCoins?: number;
    maxCoins?: number;
    page?: number;
    pageSize?: number;
  }): Promise<{ data: WantListing[]; total: number }>

  // Get listings by user
  async getUserListings(userId: string): Promise<WantListing[]>

  // Get single listing with details
  async getListing(id: string): Promise<WantListing | null>

  // Cancel a listing (only by owner)
  async cancelListing(userId: string, listingId: string): Promise<void>

  // Update listing offer (only by owner, only if no counter-offers)
  async updateListing(userId: string, listingId: string, data: {
    coinsOffered?: number;
    offeredPokemonIds?: string[];
  }): Promise<WantListing>
}
```

**Verification:**
- [ ] Unit tests pass for all functions
- [ ] Validates user owns offered Pokemon
- [ ] Validates Pokemon not already in another active listing/trade

---

#### Task 2.2: Create Want Listing Routes
**File:** `apps/api/src/routes/want-listings.ts`

**Endpoints:**
| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/want-listings` | Create new listing | Required |
| GET | `/want-listings` | List all open listings | Optional |
| GET | `/want-listings/mine` | Get user's listings | Required |
| GET | `/want-listings/:id` | Get listing details | Optional |
| PATCH | `/want-listings/:id` | Update listing | Required |
| DELETE | `/want-listings/:id` | Cancel listing | Required |

**Verification:**
- [ ] All routes return correct status codes
- [ ] Auth middleware applied correctly
- [ ] Validation middleware for request bodies

---

#### Task 2.3: Register Want Listing Routes
**File:** `apps/api/src/app.ts`

**Changes:**
- Import want-listings routes
- Register routes with `/want-listings` prefix

**Verification:**
- [ ] Routes accessible via API
- [ ] No conflicts with existing routes

---

### Phase 3: Backend API - Counter Offers

#### Task 3.1: Create Counter Offer Service
**File:** `apps/api/src/services/counter-offer.service.ts`

**Functions to implement:**
```typescript
class CounterOfferService {
  // Create counter-offer on a listing
  async createCounterOffer(userId: string, data: {
    wantListingId: string;
    offeredPokemonId: string;  // The wanted Pokemon they have
    coinsRequested: number;
    requestedPokemonIds: string[];  // Pokemon they want from listing owner
    message?: string;
  }): Promise<CounterOffer>

  // Accept counter-offer (listing owner only)
  async acceptCounterOffer(userId: string, counterOfferId: string): Promise<{
    success: boolean;
    trade: Trade;  // Creates a completed trade record
  }>

  // Reject counter-offer (listing owner only)
  async rejectCounterOffer(userId: string, counterOfferId: string): Promise<void>

  // Withdraw counter-offer (counter-offer creator only)
  async withdrawCounterOffer(userId: string, counterOfferId: string): Promise<void>

  // Get counter-offers for a listing
  async getCounterOffers(listingId: string): Promise<CounterOffer[]>

  // Get user's counter-offers
  async getUserCounterOffers(userId: string): Promise<CounterOffer[]>
}
```

**Verification:**
- [ ] Unit tests pass for all functions
- [ ] Validates offered Pokemon is the wanted species
- [ ] Validates shiny requirement if specified
- [ ] Validates user owns the offered Pokemon
- [ ] Trade executes atomically (all transfers succeed or all fail)

---

#### Task 3.2: Create Counter Offer Routes
**File:** `apps/api/src/routes/counter-offers.ts`

**Endpoints:**
| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/counter-offers` | Create counter-offer | Required |
| POST | `/counter-offers/:id/accept` | Accept counter-offer | Required |
| POST | `/counter-offers/:id/reject` | Reject counter-offer | Required |
| DELETE | `/counter-offers/:id` | Withdraw counter-offer | Required |
| GET | `/counter-offers/mine` | Get user's counter-offers | Required |

**Verification:**
- [ ] All routes return correct status codes
- [ ] Auth middleware applied correctly
- [ ] Only appropriate users can accept/reject/withdraw

---

#### Task 3.3: Register Counter Offer Routes
**File:** `apps/api/src/app.ts`

**Changes:**
- Import counter-offers routes
- Register routes with `/counter-offers` prefix

**Verification:**
- [ ] Routes accessible via API
- [ ] No conflicts with existing routes

---

### Phase 4: Direct Accept Flow

#### Task 4.1: Implement Direct Accept
**File:** `apps/api/src/services/want-listing.service.ts`

**Add function:**
```typescript
// Accept a listing directly (trade Pokemon for the exact offer)
async acceptListing(userId: string, listingId: string, pokemonId: string): Promise<{
  success: boolean;
  trade: Trade;
}>
```

**Logic:**
1. Validate listing is OPEN
2. Validate user owns a Pokemon of the wanted species (+ shiny if required)
3. Validate listing owner still has offered coins/Pokemon
4. Execute trade atomically:
   - Transfer wanted Pokemon to listing owner
   - Transfer coins to acceptor
   - Transfer offered Pokemon to acceptor
5. Mark listing as COMPLETED
6. Reject all pending counter-offers

**Verification:**
- [ ] Trade executes correctly
- [ ] All Pokemon ownership transfers
- [ ] Coins transfer correctly
- [ ] Listing status updated
- [ ] Counter-offers rejected

---

#### Task 4.2: Add Accept Route
**File:** `apps/api/src/routes/want-listings.ts`

**Add endpoint:**
| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/want-listings/:id/accept` | Accept listing directly | Required |

**Request body:**
```json
{
  "pokemonId": "uuid-of-pokemon-to-trade"
}
```

**Verification:**
- [ ] Returns success with trade details
- [ ] Returns error if validation fails

---

### Phase 5: Frontend - API Client

#### Task 5.1: Add Want Listing API Methods
**File:** `apps/web/src/services/api.ts`

**Add methods:**
```typescript
// Want Listings
async getWantListings(params?: {
  speciesId?: number;
  page?: number;
}): Promise<{ data: WantListing[]; total: number }>

async getMyWantListings(): Promise<WantListing[]>

async getWantListing(id: string): Promise<WantListing>

async createWantListing(data: {
  wantedSpeciesId: number;
  wantShiny?: boolean;
  coinsOffered: number;
  offeredPokemonIds: string[];
}): Promise<WantListing>

async cancelWantListing(id: string): Promise<void>

async acceptWantListing(id: string, pokemonId: string): Promise<{ trade: Trade }>
```

**Verification:**
- [ ] All methods make correct API calls
- [ ] Types match API response

---

#### Task 5.2: Add Counter Offer API Methods
**File:** `apps/web/src/services/api.ts`

**Add methods:**
```typescript
// Counter Offers
async createCounterOffer(data: {
  wantListingId: string;
  offeredPokemonId: string;
  coinsRequested: number;
  requestedPokemonIds: string[];
  message?: string;
}): Promise<CounterOffer>

async acceptCounterOffer(id: string): Promise<{ trade: Trade }>

async rejectCounterOffer(id: string): Promise<void>

async withdrawCounterOffer(id: string): Promise<void>

async getMyCounterOffers(): Promise<CounterOffer[]>
```

**Verification:**
- [ ] All methods make correct API calls
- [ ] Types match API response

---

#### Task 5.3: Add React Query Hooks
**File:** `apps/web/src/hooks/useApi.ts`

**Add hooks:**
```typescript
// Want Listings
export function useWantListings(params?: { speciesId?: number })
export function useMyWantListings()
export function useWantListing(id: string)
export function useCreateWantListing()
export function useCancelWantListing()
export function useAcceptWantListing()

// Counter Offers
export function useCreateCounterOffer()
export function useAcceptCounterOffer()
export function useRejectCounterOffer()
export function useWithdrawCounterOffer()
export function useMyCounterOffers()
```

**Verification:**
- [ ] Hooks handle loading/error states
- [ ] Mutations invalidate correct queries

---

### Phase 6: Frontend - UI Components

#### Task 6.1: Create Want Listing Card Component
**File:** `apps/web/src/components/trading/WantListingCard.tsx`

**Features:**
- Show wanted Pokemon sprite and name
- Show shiny badge if required
- Show coins offered
- Show Pokemon offered (thumbnails)
- Show listing owner name
- Show "Accept" button if user has matching Pokemon
- Show "Make Offer" button

**Verification:**
- [ ] Renders correctly with sample data
- [ ] Buttons are conditionally shown

---

#### Task 6.2: Create Want Listings Page
**File:** `apps/web/src/pages/WantListings.tsx`

**Features:**
- List all open want listings
- Filter by species name/search
- Filter by minimum/maximum coins
- Pagination
- "Create Want Listing" button

**Verification:**
- [ ] Page loads listings from API
- [ ] Filters work correctly
- [ ] Pagination works

---

#### Task 6.3: Create Want Listing Modal
**File:** `apps/web/src/components/trading/CreateWantListingModal.tsx`

**Features:**
- Species selector (search/autocomplete from Pokedex)
- Shiny checkbox
- Coins offered input
- Pokemon selector (from user's collection)
- Preview of listing
- Submit button

**Verification:**
- [ ] Can select species
- [ ] Can select Pokemon from collection
- [ ] Validates minimum offer (coins or Pokemon)
- [ ] Creates listing successfully

---

#### Task 6.4: Create Listing Detail Page
**File:** `apps/web/src/pages/WantListingDetail.tsx`

**Features:**
- Full listing details
- List of counter-offers (if owner)
- Accept/Reject counter-offer buttons (if owner)
- "Accept Listing" button (if visitor has matching Pokemon)
- "Make Counter-Offer" button (if visitor)

**Verification:**
- [ ] Shows all listing info
- [ ] Shows counter-offers to owner
- [ ] Actions work correctly

---

#### Task 6.5: Create Counter Offer Modal
**File:** `apps/web/src/components/trading/CounterOfferModal.tsx`

**Features:**
- Show what they're offering (the wanted Pokemon)
- Pokemon selector (only Pokemon matching wanted species)
- Coins requested input
- Pokemon requested selector (from listing owner's offered Pokemon)
- Optional message
- Submit button

**Verification:**
- [ ] Only shows matching Pokemon to offer
- [ ] Validates offer
- [ ] Creates counter-offer successfully

---

#### Task 6.6: Create My Listings Page
**File:** `apps/web/src/pages/MyWantListings.tsx`

**Features:**
- List user's want listings
- Show status (open/completed/cancelled)
- Show counter-offer count
- Cancel button for open listings
- Link to listing detail

**Verification:**
- [ ] Shows user's listings
- [ ] Cancel works
- [ ] Links to detail page

---

#### Task 6.7: Add Navigation
**File:** `apps/web/src/components/layout/Layout.tsx`

**Changes:**
- Add "Want Listings" link to navigation
- Add "My Listings" link (when authenticated)

**Verification:**
- [ ] Navigation links work
- [ ] Links show/hide based on auth state

---

#### Task 6.8: Add Routes
**File:** `apps/web/src/App.tsx`

**Add routes:**
- `/want-listings` - WantListings page
- `/want-listings/:id` - WantListingDetail page
- `/my-listings` - MyWantListings page (protected)

**Verification:**
- [ ] Routes render correct components
- [ ] Protected routes redirect to login

---

### Phase 7: Testing & Polish

#### Task 7.1: Backend Unit Tests
**File:** `apps/api/src/services/want-listing.service.test.ts`

**Test cases:**
- [ ] Create listing with valid data
- [ ] Create listing fails with invalid species
- [ ] Create listing fails with Pokemon not owned
- [ ] Get listings with filters
- [ ] Cancel listing succeeds for owner
- [ ] Cancel listing fails for non-owner
- [ ] Accept listing with valid Pokemon
- [ ] Accept listing fails without matching Pokemon

---

#### Task 7.2: Backend Unit Tests - Counter Offers
**File:** `apps/api/src/services/counter-offer.service.test.ts`

**Test cases:**
- [ ] Create counter-offer with valid data
- [ ] Create counter-offer fails without matching Pokemon
- [ ] Accept counter-offer executes trade
- [ ] Reject counter-offer updates status
- [ ] Withdraw counter-offer by creator

---

#### Task 7.3: Frontend E2E Tests
**File:** `apps/web/e2e/want-listings.spec.ts`

**Test cases:**
- [ ] Create want listing flow
- [ ] Browse and filter listings
- [ ] Accept listing directly
- [ ] Create counter-offer flow
- [ ] Accept/reject counter-offer

---

#### Task 7.4: Add Loading States
**Files:** All new UI components

**Changes:**
- Add skeleton loaders for listing cards
- Add loading spinners for actions
- Add optimistic updates for accept/reject

**Verification:**
- [ ] Loading states show correctly
- [ ] No layout shifts

---

#### Task 7.5: Add Error Handling
**Files:** All new UI components

**Changes:**
- Show error toasts for failed actions
- Show error states for failed loads
- Add retry buttons

**Verification:**
- [ ] Errors shown to user
- [ ] Can retry failed actions

---

### Phase 8: Notifications (Optional Enhancement)

#### Task 8.1: Add Notification System
**Files:**
- `apps/api/src/services/notification.service.ts`
- `apps/api/prisma/schema.prisma`

**Features:**
- Notify listing owner when counter-offer received
- Notify counter-offerer when accepted/rejected
- Notify when listing they're interested in closes

---

## Summary

| Phase | Tasks | Priority |
|-------|-------|----------|
| Phase 1 | Database Setup | Critical |
| Phase 2 | Want Listing Backend | Critical |
| Phase 3 | Counter Offer Backend | Critical |
| Phase 4 | Direct Accept Flow | Critical |
| Phase 5 | Frontend API Client | Critical |
| Phase 6 | Frontend UI | Critical |
| Phase 7 | Testing & Polish | High |
| Phase 8 | Notifications | Medium |

**Total Tasks:** 27 (excluding optional Phase 8)

**Estimated Implementation Order:**
1. Tasks 1.1, 1.2 (Database)
2. Tasks 2.1, 2.2, 2.3 (Want Listing API)
3. Tasks 3.1, 3.2, 3.3 (Counter Offer API)
4. Task 4.1, 4.2 (Direct Accept)
5. Tasks 5.1, 5.2, 5.3 (Frontend API)
6. Tasks 6.1-6.8 (Frontend UI)
7. Tasks 7.1-7.5 (Testing)
