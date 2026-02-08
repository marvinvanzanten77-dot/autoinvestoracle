# Observer Mode Restrictions - Obsolete Code Audit

**Status:** Phase 2 transitie van read-only observer naar trading agent  
**Date:** February 8, 2026  
**Impact:** HIGH - Multiple UI labels, system prompts, and comments need updating

---

## 🔴 CRITICAL FINDINGS - Hardcoded Restrictions

### 1. Agent.tsx - UI Labels (Line 191)
**File:** [src/pages/Agent.tsx](src/pages/Agent.tsx#L191)  
**Current Code:**
```tsx
{(conn.metadata?.apiMode || conn.metadata?.agentMode || 'readonly') === 'readonly' 
  ? '👁️ Alleen observatie' 
  : '🤖 Volledige rechten'}
```

**Issue:** Says "👁️ Only observation" for readonly mode, but system can now trade  
**Fix Needed:** Update to reflect actual capabilities based on policy, not API mode

---

### 2. Agent.tsx - Observation-Only Section (Lines 226-447)
**File:** [src/pages/Agent.tsx](src/pages/Agent.tsx#L226)  
**Current Code:**
```tsx
{/* Readonly agent settings */}
{agentSettings.apiMode === 'readonly' && (
  <div className="space-y-4 rounded-lg bg-blue-50/50 border border-blue-200/50 p-4">
    <div className="flex items-center gap-2 mb-4">
      <span className="text-xl">👁️</span>
      <p className="text-sm font-medium text-slate-700">Observerend Agent</p>  // Line 226
    </div>
```

**Issue:** 
- Hardcoded to "Observing Agent" (Observerend Agent)
- Settings are gated on `apiMode === 'readonly'`
- But actual trading capability depends on **policy**, not API mode
- Trading agent uses same API mode but different policy

**Fix Needed:** 
- Gate on **policy.tradePerDay > 0**, not apiMode
- Show policy name instead of API mode
- Update all labels to reflect actual trading capability

---

### 3. AgentChat.tsx - Hardcoded Monitoring Messages
**File:** [src/components/AgentChat.tsx](src/components/AgentChat.tsx#L142)  
**Current Code:**
```tsx
agentResponse =
  'Auto-trading mode: Momenteel sta je in monitoring-mode (read-only). ' +
  'Je kunt dit wijzigen naar trading-mode, waarna ik automatisch zal handelen volgens je regels. ' +
  'Let op: Dit is een keuze voor je instellingen, niet iets wat ik zal doen.';
```

**Issue:** 
- Hardcoded message says user is in "monitoring-mode (read-only)"
- But user might already be in trading mode
- Message is inaccurate after policy changes

**Fix Needed:**
- Make response dynamic based on actual policy
- Show current policy name and mode
- Remove hardcoded mode assumptions

---

### 4. AgentChat.tsx - Status Message (Line 158)
**File:** [src/components/AgentChat.tsx](src/components/AgentChat.tsx#L158)  
**Current Code:**
```tsx
'Volgens je huidige instellingen: monitoring-mode, momenteel geen auto-trading. ' +
```

**Issue:** Hardcoded to say "monitoring-mode, no auto-trading"  
**Fix Needed:** Show actual policy: `${policy.name}, ${policy.tradePerDay} trades/day`

---

## 🟠 HIGH PRIORITY - System Prompts Still Observer-Only

### 5. api/index.ts - Chat System Prompt (Lines 1625-1649)
**File:** [api/index.ts](api/index.ts#L1625)  
**Current Code:**
```typescript
const systemPrompt = hasExchangeAccess && activePlatform
  ? `Je bent een crypto-assistent die ook concrete voorstellen mag doen. Je hebt toegang tot het gekoppelde account van de gebruiker op ${activePlatform}.
  
  COMMUNICATIE:
  - Geef uitleg en opties in mensentaal
  
  VOORSTELLEN GENEREREN (NIEUW!):
  - Als je een concrete actie wilt voorstellen (trade, settings wijziging), wrap die in:
  ###PROPOSAL:{JSON}###END
  
  VEILIGHEID:
  - Alleen voorstellen, NOOIT uitvoeren  // ← Still says "only proposals, never execute"
  - Gebruiker moet akkoord geven in Trading Dashboard
  
  BELANGRIJK:
  - Je mag ALLEEN advies geven over munten die beschikbaar zijn op ${activePlatform}
  - Alleen assets die beschikbaar zijn: ${availableAssets.join(', ')}`
    : `Je bent een rustige crypto-assistent. Je geeft geen advies of besluiten, alleen uitleg en opties in mensentaal.`;
```

**Issues:**
1. Still says "ONLY proposals, NEVER execute" - outdated for trading mode
2. No distinction based on **policy**
3. If user has trading policy, AI should know it can actually execute
4. Should mention: "Wait for user approval" vs "Auto-execute per policy"

**Fix Needed:**
```typescript
const systemPrompt = hasExchangeAccess && activePlatform
  ? `You are a crypto assistant managing ${activePlatform}.
     Current policy: ${policyName}, ${tradePerDay} trades/day max.
     
     PROPOSALS & EXECUTION:
     ${tradePerDay > 0 
       ? `- You can suggest AND execute trades per policy
         - Execution: Auto if confidence > ${minConfidence} and within daily limit
         - Notify user after execution`
       : `- You can only suggest trades (proposals)
         - User must approve in Dashboard`}`
    : `You are a passive crypto observer...`;
```

---

### 6. api/index.ts - Insights System Prompt (Line 1857)
**File:** [api/index.ts](api/index.ts#L1857)  
**Current Code:**
```typescript
content: 'Je bent een rustige crypto-observator die alleen verdelingen geeft in JSON.'
```

**Issue:** 
- Says "quiet observer"  
- But insights should reflect actual system capability

**Fix Needed:** Update based on policy, not static role

---

### 7. src/server/handlers/portfolioAllocate.ts (Lines 85, 87, 102)
**File:** [src/server/handlers/portfolioAllocate.ts](src/server/handlers/portfolioAllocate.ts#L85)  
**Current Code:**
```typescript
`- Gebruik alleen de 4 labels.`,
`- Geen advies of voorspellingen, alleen verdeling en toelichting.`
```

And:
```typescript
content: 'Je bent een rustige crypto-observator die alleen verdelingen geeft in JSON.'
```

**Issue:** Says "no advice or predictions, only allocation" - but system now makes trading decisions  
**Fix Needed:** Update prompt to reflect trading agent capabilities

---

### 8. src/server/handlers/chat.ts (Line 36)
**File:** [src/server/handlers/chat.ts](src/server/handlers/chat.ts#L36)  
**Current Code:**
```typescript
'Je bent een rustige crypto-assistent. Je geeft geen advies of besluiten, alleen uitleg en opties in mensentaal.'
```

**Issue:** 
- Says "no decisions, only explanation"
- But trading agent MAKES decisions

**Fix Needed:** Update based on actual mode and policy

---

## 🟡 MEDIUM PRIORITY - Outdated Documentation Assumptions

### 9. Multiple Documentation Files Reference "Read-Only"
**Files affected:**
- [SETUP_PHASE2.md](SETUP_PHASE2.md) - Lines 105-118: References "read-only" API keys
- [PHASE2_SUMMARY.md](PHASE2_SUMMARY.md) - Multiple lines
- [README.md](README.md) - Likely mentions read-only

**Issue:** Documentation still positions system as read-only by default  
**Fix Needed:** Update to show trading agent as primary mode

---

### 10. FUNCTIONALITY_STATUS.md - Production Status
**File:** [FUNCTIONALITY_STATUS.md](FUNCTIONALITY_STATUS.md)  
**Current Status:**
```
The Auto Invest Oracle application is production-ready for read-only monitoring mode
```

**Issue:** Says "read-only monitoring" is primary mode  
**Fix Needed:** Update to reflect trading agent as main feature

---

## 🔵 CODE PATTERNS - Observer Mode Hardcoding

### Pattern 1: API Mode vs Policy Confusion
Multiple files check `apiMode === 'readonly'` or `apiMode === 'trading'`:
- [src/pages/Agent.tsx](src/pages/Agent.tsx#L220) Line 220: `agentSettings.apiMode === 'readonly'`
- [src/components/AgentStatePanel.tsx](src/components/AgentStatePanel.tsx#L223) Line 223

**Issue:** API mode (read/write access) ≠ Trading capability (policy)
**Fix Needed:** Create dedicated `agent.policy` state instead of conflating with apiMode

---

### Pattern 2: Hardcoded "Monitoring" Defaults
**Files:**
- [src/components/AgentChat.tsx](src/components/AgentChat.tsx#L142) - Says "monitoring-mode"
- [src/components/AgentStatePanel.tsx](src/components/AgentStatePanel.tsx#L53) - `mode: 'observer'`

**Issue:** Always defaults to observer mode, not current policy  
**Fix Needed:** Pass actual policy to API, not hardcoded mode

---

### Pattern 3: "Rustige" (Quiet) Observer Language
Used in multiple prompts:
- "Je bent een rustige crypto-observator"
- "Je geeft geen advies"
- "Alleen uitleg en opties"

**Issue:** This language is incompatible with trading agent  
**Fix Needed:** Conditional language based on policy

---

## 📊 SUMMARY TABLE

| Component | Type | Current State | Should Be | Priority |
|-----------|------|---------------|-----------|----------|
| Agent.tsx UI Label | UI | "👁️ Only observation" | Policy-based | 🔴 CRITICAL |
| Agent.tsx Settings Gate | Logic | `apiMode === 'readonly'` | `policy.tradePerDay > 0` | 🔴 CRITICAL |
| AgentChat Messages | Content | Hardcoded "monitoring" | Dynamic per policy | 🟠 HIGH |
| Chat System Prompt | AI Config | "Only proposals" | "Execute per policy" | 🟠 HIGH |
| Insights Prompt | AI Config | "Quiet observer" | "Active trader" | 🟠 HIGH |
| Portfolio Prompt | AI Config | "No decisions" | "Decision-maker" | 🟠 HIGH |
| Server Handler Chat | AI Config | "No decisions" | "Trading decisions" | 🟠 HIGH |
| Documentation | Content | "Read-only first" | "Trading agent" | 🟡 MEDIUM |
| Status Docs | Content | "Read-only mode" | "Trading mode" | 🟡 MEDIUM |

---

## 🎯 IMPLEMENTATION ROADMAP

### Phase 1: Frontend (This Week)
1. ✅ Update Agent.tsx UI to show policy, not apiMode
2. ✅ Fix AgentChat hardcoded messages
3. ✅ Gate settings on `policy.tradePerDay > 0`

### Phase 2: Backend (Next)
1. ✅ Update all system prompts to check policy
2. ✅ Make AI prompts dynamic based on trading capability
3. ✅ Remove hardcoded mode assumptions

### Phase 3: Documentation (Cleanup)
1. ✅ Update status docs to reflect trading agent
2. ✅ Remove read-only assumptions
3. ✅ Document policy-based behavior

---

## ⚠️ RISKS IF NOT UPDATED

1. **User Confusion**: UI says "observation only" but system executes trades
2. **AI Misbehavior**: AI thinks it can't execute but system tries to execute
3. **Documentation Lies**: New users read "read-only mode" and are confused
4. **Maintenance Debt**: Each new feature must work around legacy observer assumptions

---

## 🔗 RELATED ISSUES

- API mode (read/write keys) is conflated with trading policy
- No clear separation of concerns: API access vs trading authorization
- System prompt generation doesn't account for policy settings
- UI layer still thinks in terms of "readonly" vs "trading" API mode

