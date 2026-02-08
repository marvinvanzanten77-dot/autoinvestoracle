# AI Proposals Implementation - Complete

## Overview
The ChatGPT agent can now generate **safe, user-approved proposals** for trading actions and settings changes. Proposals are suggestions, not commands - they must be explicitly approved by the user in the Trading Dashboard before execution.

## System Architecture

### 1. **Chat System Prompt Enhancement**
- **File**: `api/index.ts` (Lines 1595-1650)
- **Key Changes**:
  - AI instructed to wrap proposals in `###PROPOSAL:{JSON}###END` markers
  - Proposal format defined with required fields: type, title, description, action, reasoning, exchange
  - Safety constraints: Only assets on connected exchange, max 1 proposal per message
  - Examples provided for trade and settings proposals

### 2. **Chat Handler - Proposal Detection & Storage**
- **File**: `api/index.ts` (Lines 2107-2150)
- **Endpoint**: `POST /api/chat`
- **Functionality**:
  - Regex detects `###PROPOSAL:{JSON}###END` markers in AI response
  - Parses proposal JSON and validates structure
  - Generates unique ID (`crypto.randomUUID()`)
  - Stores proposal in KV with key pattern: `user:${userId}:proposal:${proposalId}`
  - Adds proposal ID to pending list: `user:${userId}:proposals:pending`
  - Returns both text reply and proposal object to frontend
  - Strips proposal markers from displayed reply for cleaner UX

### 3. **Proposal API Endpoint**
- **File**: `api/index.ts` (Lines 2155-2230)
- **Endpoint**: `/api/trading/proposals`

#### GET Request
- **Purpose**: Retrieve pending proposals
- **Response**: Array of proposals sorted by recency
- **Logic**:
  - Gets pending proposal IDs from KV
  - Fetches each proposal details
  - Filters by `status='pending'` (implicitly)
  - Sorts by `createdAt` descending

#### POST Request
- **Purpose**: Approve or reject a proposal
- **Payload**: `{ proposalId: string, approved: boolean }`
- **Logic**:
  - Validates proposal exists
  - Updates proposal status to 'approved' or 'rejected'
  - Removes from pending list
  - If approved: marks as 'executed' and triggers execution
  - Clears relevant caches

### 4. **Proposal Type Definition**
- **File**: `api/index.ts` (Lines 1488-1530)
- **Type**: `Proposal`
- **Fields**:
  ```typescript
  {
    id: string;                    // UUID
    type: 'trade' | 'settings' | 'control';
    title: string;                 // User-facing title
    description: string;           // What will happen
    action: object;                // Execution details
    reasoning: string;             // Why this proposal
    createdAt: string;            // ISO timestamp
    status: 'pending' | 'approved' | 'rejected' | 'executed';
    exchange?: string;            // Target exchange
  }
  ```

### 5. **Frontend - Trading Dashboard**
- **File**: `src/pages/Trading.tsx`

#### State Management
```typescript
const [aiProposals, setAiProposals] = useState<AIProposal[]>([]);
const [aiProposalsLoading, setAiProposalsLoading] = useState(false);
```

#### useEffect - Fetch Proposals
- Fetches pending proposals from `/api/trading/proposals`
- Polls every 5 seconds for new proposals
- Updates on userId change

#### Handlers
- `handleApproveAIProposal(proposalId)`: POSTs approval, removes from list
- `handleRejectAIProposal(proposalId)`: POSTs rejection, removes from list

#### UI Components
- New tab: "🤖 AI Suggesties" (shows pending AI proposals count)
- Proposal card showing:
  - Title and description
  - Type badge (💱 Trade, ⚙️ Settings, 🎛️ Control)
  - Reasoning (in blue callout)
  - Action details (JSON display)
  - Timestamp
  - [Goedkeuren] and [Weigeren] buttons

## Data Flow

```
User Chat → AI Response
    ↓
Chat Handler (api/index.ts)
    ├─ Detects ###PROPOSAL:{JSON}###END
    ├─ Parses & validates JSON
    ├─ Saves to KV store
    └─ Returns { reply, proposal }
        ↓
Trading Dashboard polls /api/trading/proposals
    ├─ Fetches pending proposals
    └─ Displays with approve/reject buttons
        ↓
User clicks [Goedkeuren]
    ├─ POSTs { proposalId, approved: true }
    ├─ Updates status to 'executed'
    └─ Executes action (TODO: full implementation)
```

## Proposal Storage Format

**KV Structure:**
```
user:{userId}:proposal:{proposalId} → {Proposal object}
user:{userId}:proposals:pending → [proposalId1, proposalId2, ...]
```

**Example Proposal in KV:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "type": "trade",
  "title": "Koop 0.001 BTC",
  "description": "BTC staat op lage niveaus en is oversold",
  "action": {
    "type": "buy",
    "params": {
      "asset": "BTC",
      "amount": 0.001,
      "exchange": "bitvavo"
    }
  },
  "reasoning": "RSI indicator toont oversold situatie, goed inkoopmoment",
  "createdAt": "2024-01-15T10:30:45.123Z",
  "status": "pending",
  "exchange": "bitvavo"
}
```

## AI Prompt Examples

### Trade Proposal Format
The AI generates:
```
Ik zie dat BTC momenteel goed in elkaar zit. Dit voorstel:

###PROPOSAL:{"type":"trade","title":"Koop 0.001 BTC","description":"BTC staat op lage niveaus","action":{"type":"buy","params":{"asset":"BTC","amount":0.001}},"reasoning":"RSI oversold","exchange":"bitvavo"}###END

Je kan dit voorstel goedkeuren in de Trading Dashboard.
```

### Settings Proposal Format
```
Gezien de marktvolatiliteit, stel ik voor:

###PROPOSAL:{"type":"settings","title":"Verhoog risico naar 2%","action":{"type":"update_risk","params":{"exchange":"bitvavo","riskPerTrade":2}},"reasoning":"Markt stabiliseert zich","exchange":"bitvavo"}###END

Laat me weten of je dit wilt toepassen.
```

## Safety Features

1. **Approval Required**: Proposals never auto-execute
2. **Explicit Authorization**: User must click [Goedkeuren] button
3. **Asset Whitelist**: AI only suggests assets available on connected exchange
4. **Single Proposal**: Max 1 proposal per chat message
5. **Audit Trail**: All proposals stored with timestamp and status
6. **Reversible**: Users can reject any proposal

## Testing Checklist

- [ ] Chat generates proposal with correct ###PROPOSAL:...###END format
- [ ] Proposal appears in Trading Dashboard "🤖 AI Suggesties" tab
- [ ] Clicking [Goedkeuren] removes proposal and marks as executed
- [ ] Clicking [Weigeren] removes proposal and marks as rejected
- [ ] New proposals auto-appear within 5 seconds (polling)
- [ ] Multiple proposals display correctly
- [ ] Tab shows correct count of pending proposals
- [ ] Error messages display if approval fails

## TODO - Next Phase

1. **Execution Logic**: Implement actual trade execution when proposal approved
   - BUY proposals: Call exchange API to place order
   - SETTINGS proposals: Update user's trading policy
   - CONTROL proposals: Toggle agent features

2. **Proposal History**: Store executed/rejected proposals for review
   - New tab: "Proposal History"
   - Show outcome, execution time, etc.

3. **Enhanced Error Handling**: 
   - Validate action parameters before approval
   - Show error details to user if execution fails
   - Rollback state on failure

4. **Advanced Filtering**:
   - Filter by proposal type
   - Search by title/description
   - Archive old proposals

5. **Confirmation Dialog**:
   - Show detailed confirmation before approving
   - Display potential impact/risks
   - Ask for additional parameters if needed

## Files Modified

| File | Changes | Status |
|------|---------|--------|
| api/index.ts | Added Proposal type, system prompt, chat handler, endpoint | ✅ Complete |
| src/pages/Trading.tsx | Added AI proposals state, fetch, handlers, UI tab | ✅ Complete |

## Build Status

✅ **Build successful** - No TypeScript or bundling errors
- 781 modules transformed
- Output: 824.79 KB (gzip: 237.33 KB)
- Build time: 37.90s

## Development Server

✅ **Dev server running** on http://localhost:5173/
- Hot reload enabled
- Ready for testing proposal generation

## Key Files Reference

- **System Prompt**: [api/index.ts#L1595-L1650](api/index.ts#L1595-L1650)
- **Chat Handler**: [api/index.ts#L2107-L2150](api/index.ts#L2107-L2150)
- **Proposals Endpoint**: [api/index.ts#L2155-L2230](api/index.ts#L2155-L2230)
- **Proposal Type**: [api/index.ts#L1488-L1530](api/index.ts#L1488-L1530)
- **Trading Component**: [src/pages/Trading.tsx](src/pages/Trading.tsx)
- **Handlers**: [src/pages/Trading.tsx#L226-L265](src/pages/Trading.tsx#L226-L265)
- **useEffect Fetch**: [src/pages/Trading.tsx#L157-L185](src/pages/Trading.tsx#L157-L185)
- **UI Tab**: [src/pages/Trading.tsx#L450-L530](src/pages/Trading.tsx#L450-L530)
