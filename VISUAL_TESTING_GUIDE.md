# 🤖 AI Proposals Feature - Visual Testing Guide

## Screenshot Guide (What You'll See)

### 1. Chat Interface

**Before (Regular Chat):**
```
┌─────────────────────────────────────────────┐
│ User: "Should I buy Bitcoin?"               │
├─────────────────────────────────────────────┤
│ AI: "Bitcoin looks good right now based on  │
│     technical analysis. Here's my proposal  │
│     for a position..."                      │
└─────────────────────────────────────────────┘
```

**Behind the scenes:**
The AI response actually contains:
```
"...Here's my proposal for a position...

###PROPOSAL:{"type":"trade","title":"Koop 0.001 BTC",...}###END

Click approve in the Trading Dashboard to execute."
```

**What user sees (clean):**
```
"...Here's my proposal for a position..."
(Proposal markers automatically removed)
```

### 2. Trading Dashboard - AI Suggesties Tab

**When you click "🤖 AI Suggesties" tab:**

```
┌─────────────────────────────────────────────────────────┐
│ Trading Dashboard                                        │
├─────────────────────────────────────────────────────────┤
│ [📋 Voorstellen] [🤖 AI Suggesties (1)] [⚙️ Actief Policy] │
├─────────────────────────────────────────────────────────┤
│                                                           │
│ ┌──────────────────────────────────────────────┐        │
│ │ 🤖 AI Suggesties                             │        │
│ │ Voorgestelde acties van de ChatGPT agent     │        │
│ └──────────────────────────────────────────────┘        │
│                                                           │
│ ┌──────────────────────────────────────────────┐        │
│ │ Koop 0.001 BTC              💱 Trade         │        │
│ │ BTC staat op lage niveaus                    │        │
│ │                                              │        │
│ │ Redenering:                                  │        │
│ │ ┌──────────────────────────────────────────┐│        │
│ │ │ RSI indicator toont oversold situatie    ││        │
│ │ └──────────────────────────────────────────┘│        │
│ │                                              │        │
│ │ Actie:                                       │        │
│ │ {                                            │        │
│ │   "type": "buy",                             │        │
│ │   "params": {                                │        │
│ │     "asset": "BTC",                          │        │
│ │     "amount": 0.001                          │        │
│ │   }                                          │        │
│ │ }                                            │        │
│ │                                              │        │
│ │ 2024-01-15 10:30:45                         │        │
│ │                                              │        │
│ │ [✓ Goedkeuren]  [✕ Weigeren]               │        │
│ └──────────────────────────────────────────────┘        │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

### 3. Clicking Goedkeuren (Approve)

**Before:**
- Proposal card visible in dashboard
- Tab shows: "🤖 AI Suggesties (1)"

**After clicking [✓ Goedkeuren]:**
```
Alert appears:
┌─────────────────────────────┐
│ ✓ AI voorstel goedgekeurd   │
│   en uitgevoerd             │
│                             │
│        [OK]                 │
└─────────────────────────────┘
```

**Then:**
- Proposal card disappears
- Tab updates: "🤖 AI Suggesties (0)"
- Proposal marked as 'executed' in backend

### 4. Clicking Weigeren (Reject)

**Before:**
- Proposal card visible in dashboard

**After clicking [✕ Weigeren]:**
```
Alert appears:
┌──────────────────────────────┐
│ ✓ AI voorstel afgewezen      │
│                              │
│        [OK]                  │
└──────────────────────────────┘
```

**Then:**
- Proposal card disappears
- Tab count decreases
- Proposal marked as 'rejected' in backend

---

## UI Component Breakdown

### Proposal Card Layout

```
┌─────────────────────────────────────────────────────────┐
│                                                           │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ Title                              [Type Badge]      │ │
│ │ Description of what will happen                      │ │
│ └──────────────────────────────────────────────────────┘ │
│                                                           │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ Redenering:                                          │ │
│ │ Blue box with the AI's reasoning                     │ │
│ └──────────────────────────────────────────────────────┘ │
│                                                           │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ Actie:                                               │ │
│ │ {"type": "buy", "params": {...}}                     │ │
│ └──────────────────────────────────────────────────────┘ │
│                                                           │
│ Timestamp: 2024-01-15 10:30:45                           │
│                                                           │
│ [✓ Goedkeuren]          [✕ Weigeren]                    │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

### Type Badges

```
💱 Trade    - For buy/sell actions
⚙️ Settings - For configuration changes
🎛️ Control - For system control actions
```

Each badge shows on the right side of the proposal card.

---

## Testing Scenarios

### Scenario 1: Single Proposal

**Steps:**
1. Chat: "Buy Bitcoin when it dips?"
2. Wait for response
3. Open Trading Dashboard
4. Click "🤖 AI Suggesties" tab
5. **Expected**: 1 proposal appears

**Result**: ✅ If proposal visible within 5 seconds

### Scenario 2: Multiple Proposals

**Steps:**
1. Generate first proposal (as above)
2. Chat: "Any good altcoins to buy?"
3. Wait for response
4. Tab shows "🤖 AI Suggesties (2)"
5. Both proposals visible

**Result**: ✅ If both proposals appear and count is correct

### Scenario 3: Approve Flow

**Steps:**
1. Have proposal visible in dashboard
2. Note the proposal ID (first few chars)
3. Click [✓ Goedkeuren]
4. See success alert
5. Proposal disappears
6. Count decreases

**Result**: ✅ If alert appears and proposal removed

### Scenario 4: Reject Flow

**Steps:**
1. Have proposal visible in dashboard
2. Click [✕ Weigeren]
3. See success alert
4. Proposal disappears

**Result**: ✅ If alert appears and proposal removed

### Scenario 5: Real-Time Update

**Steps:**
1. Keep "🤖 AI Suggesties" tab open
2. In another window/tab, chat to AI
3. Generate new proposal
4. **Without refreshing**, watch dashboard tab
5. New proposal should appear automatically

**Result**: ✅ If new proposal appears within 5 seconds

---

## Expected Behavior Reference

| Action | Expected Behavior | Success Criteria |
|--------|-------------------|------------------|
| **Chat generates proposal** | Proposal text appears, markers hidden | User sees normal reply, no JSON markers |
| **Open AI Suggesties tab** | Proposals load | Proposal cards visible within 2 seconds |
| **New proposal during session** | Auto-appears | Proposal visible within 5 seconds, no refresh needed |
| **Click [Goedkeuren]** | Alert shows, proposal removed | "✓ AI voorstel goedgekeurd" alert, card disappears |
| **Click [Weigeren]** | Alert shows, proposal removed | "✓ AI voorstel afgewezen" alert, card disappears |
| **Multiple proposals** | All visible, count correct | Tab shows "🤖 AI Suggesties (N)" where N is count |
| **Empty dashboard** | Empty state message | "Geen AI suggesties beschikbaar" message |

---

## Troubleshooting While Testing

| Issue | Possible Cause | Fix |
|-------|---|---|
| **No proposals appearing** | Chat didn't generate proposal | Check AI response for `###PROPOSAL:...###END` |
| **Proposal not updating** | Polling hasn't triggered yet | Wait up to 5 seconds, or refresh manually |
| **Type badge not showing** | Type field invalid | Check proposal JSON has `"type": "trade"\|"settings"\|"control"` |
| **Approval fails with error** | Backend error or invalid data | Check browser console for error message |
| **Proposal appears but no buttons** | UI component rendering issue | Hard refresh (Ctrl+Shift+R) and try again |
| **Count in tab incorrect** | State not syncing | Refresh page, count should update |

---

## Console Debugging

**Open Browser DevTools (F12) → Console Tab**

**You should see:**
```
[trading/proposals GET] Fetching proposals for user: 12345
[trading/proposals] Proposal 550e8400... approved
✓ Goedkeuren successful
```

**If errors, look for:**
```
Error fetching AI proposals: ...
Error approving AI proposal: ...
Could not parse proposal: ...
```

These indicate where to look for problems.

---

## Network Requests (DevTools → Network)

**When opening "🤖 AI Suggesties" tab:**
```
GET /api/trading/proposals
← Response: { "proposals": [...] }
← Status: 200
```

**When clicking [Goedkeuren]:**
```
POST /api/trading/proposals
← Body: { "proposalId": "...", "approved": true }
← Response: { "proposal": {...} }
← Status: 200
```

**Expected every 5 seconds:**
```
GET /api/trading/proposals
(Polling request for updates)
```

---

## Visual Checklist for Testing

- [ ] Proposal text appears in chat (markers hidden)
- [ ] Tab shows correct count "🤖 AI Suggesties (N)"
- [ ] Clicking tab shows proposal cards
- [ ] Each card has title, description, reasoning, action
- [ ] Type badge shows with correct emoji
- [ ] Both buttons visible and clickable
- [ ] Timestamp displays in correct locale format
- [ ] Loading spinner shows while fetching
- [ ] Empty state shows when no proposals
- [ ] Alert appears on approval
- [ ] Alert appears on rejection
- [ ] Proposal removed from UI after action
- [ ] Multiple proposals display in correct order (newest first)
- [ ] No console errors
- [ ] No UI broken elements

---

## Performance Expectations

| Metric | Expected | Max Acceptable |
|--------|----------|---|
| **First fetch time** | 0.5-1s | 2s |
| **Polling interval** | 5s | 10s |
| **Tab switch time** | <100ms | 500ms |
| **Approval response** | <1s | 3s |
| **Rejection response** | <1s | 3s |
| **Proposal display** | <200ms | 1s |

---

## Quick Test Summary

**Total time: ~2 minutes**

1. **30 seconds**: Open app, go to Trading Dashboard
2. **30 seconds**: Chat to AI, ask about buying something
3. **30 seconds**: Click "🤖 AI Suggesties" tab
4. **20 seconds**: Click [Goedkeuren] button
5. **10 seconds**: Verify success alert and removal

**Success Criteria**: Proposal appears in dashboard and can be approved/rejected

---

## Full Test Summary

**Total time: ~10 minutes**

1. **Test single proposal** (2 min)
2. **Test multiple proposals** (2 min)
3. **Test approval flow** (2 min)
4. **Test rejection flow** (2 min)
5. **Test real-time updates** (2 min)

**Success Criteria**: All scenarios work as described above

---

## Share Results

After testing, please report:

✅ **What worked:**
- Proposals appeared in dashboard
- Approval/rejection buttons worked
- Alerts showed correct messages

❌ **What didn't work:**
- Proposal didn't appear
- Button click had no effect
- Error messages shown

📊 **Observations:**
- Response time
- UI appearance
- Any visual glitches

This feedback helps improve the feature for production!

---

**Happy Testing! 🚀**
