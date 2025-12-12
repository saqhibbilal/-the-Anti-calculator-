# Architecture Analysis & Problem Identification

## 🔴 CRITICAL PROBLEMS IDENTIFIED

### Problem 1: LLM Not Using Function Calling

**Symptom**: Bot gives long markdown-formatted responses without calling calculation tools
**Root Cause**:

- System prompt doesn't STRONGLY enforce tool usage
- Tool descriptions might not be clear enough
- LLM is generating responses instead of calling functions

**Example**: User asks "I make 20k a month, can I afford Dubai Marina?"

- ❌ **Current**: LLM generates full response with markdown, estimates numbers
- ✅ **Expected**: LLM calls `analyze_buy_vs_rent` or `calculate_mortgage` with extracted params

### Problem 2: ERR_EMPTY_RESPONSE Error

**Symptom**: API endpoint crashes after first response
**Root Cause**:

- Error handling in streaming logic
- Mistral API might be returning errors not caught
- The non-streaming call might be failing silently
- Conversation state might be corrupted

### Problem 3: No Backend Parameter Extraction

**Current Flow**:

```
User Message → LLM → (hopefully) Tool Call → Math Functions
```

**Problem**:

- We're 100% trusting LLM to extract parameters
- No regex/backend extraction as suggested in flow.md
- If LLM hallucinates a number, we use it

**Should Be**:

```
User Message → Backend Regex Extraction → LLM (only if needed) → Tool Call → Math Functions
```

### Problem 4: Sending Full Conversation History

**Current**: Every API call sends ALL messages in conversation
**Problem**:

- Expensive (more tokens = more cost)
- Slow (more tokens = slower response)
- Unnecessary (we only need recent context)

**Should Be**: Only last 5-7 messages + extracted parameters

### Problem 5: No Parameter Validation

**Current**: We trust whatever LLM extracts
**Problem**:

- No validation if propertyPrice is reasonable
- No check if all required params exist before tool call
- Tool might fail silently

---

## 📐 CURRENT ARCHITECTURE

### Flow Diagram (Current)

```
1. User sends message
   ↓
2. Frontend: ChatInterface.tsx → POST /api/chat
   ↓
3. Backend: app/api/chat/route.ts
   - Gets conversation state (all messages)
   - Adds user message
   - Calls Mistral API (non-streaming first)
   ↓
4. Mistral API Response
   ├─ Has tool_calls? → Execute tools → Call Mistral again (streaming)
   └─ No tool_calls? → Stream response directly
   ↓
5. Stream response to frontend
   ↓
6. Frontend updates UI
```

### Function Calling Flow (Current)

```
1. Mistral receives: [system, user_msg_1, user_msg_2, ...]
2. Mistral decides: "Should I call a tool?"
3. If yes → Returns tool_calls
4. Backend executes tool → Adds result to messages
5. Mistral receives: [...previous, tool_result]
6. Mistral formats final response
```

### Math Functions (lib/math.ts)

✅ **GOOD**: All math is deterministic
✅ **GOOD**: No LLM involvement in calculations
✅ **GOOD**: UAE rules enforced (80% LTV, 7% upfront, 4.5% rate)

### Mistral Integration (lib/mistral.ts)

⚠️ **ISSUE**: Tool descriptions might not be clear enough
⚠️ **ISSUE**: System prompt doesn't enforce tool usage strongly
⚠️ **ISSUE**: No fallback if LLM doesn't call tools

---

## 🎯 DESIRED ARCHITECTURE (Per flow.md)

### Improved Flow

```
1. User sends message
   ↓
2. Backend receives message
   ↓
3. Backend extracts parameters (regex + LLM)
   - Regex: "2M", "1.8M", "20k", "5 years", "down payment 300k"
   - Store in extractedData
   ↓
4. Check: Do we have ALL required params for a function?
   ├─ YES → Skip LLM, run math directly → Format with LLM
   └─ NO → Call LLM to ask for missing params
   ↓
5. If LLM needed:
   - Send only last 5 messages + extracted params
   - LLM decides: tool_call or ask question
   ↓
6. Execute tool if called
   ↓
7. Format response (natural language)
   ↓
8. Stream to frontend
```

### Parameter Extraction Layer (NEW - Needed)

```typescript
// lib/extractors.ts
function extractParameters(message: string): {
  propertyPrice?: number;
  income?: number;
  downPayment?: number;
  tenure?: number;
  monthlyRent?: number;
  stayDuration?: number;
};
```

### Smart Function Calling Logic (NEW - Needed)

```typescript
// Check if we can skip LLM
if (hasAllRequiredParams(scenario, extractedData)) {
  // Skip LLM, run math directly
  const result = executeTool(scenario, extractedData);
  // Only use LLM for formatting
  const formatted = formatWithLLM(result);
  return formatted;
} else {
  // Use LLM to ask for missing params
  const response = await callLLM(messages, tools);
  return response;
}
```

---

## 🔧 SPECIFIC ISSUES TO FIX

### Issue 1: System Prompt Too Weak

**Location**: `lib/mistral.ts` → `getSystemPrompt()`

**Current**: "Always use the calculation tools - NEVER guess or estimate numbers"

**Problem**: Not strong enough. LLM still generates responses.

**Fix Needed**:

- Make tool usage MANDATORY
- Add examples of when to call tools
- Penalize non-tool responses

### Issue 2: Tool Descriptions Unclear

**Location**: `lib/mistral.ts` → `getAvailableTools()`

**Current**: "Calculate mortgage details including EMI..."

**Problem**: LLM might not understand WHEN to call it

**Fix Needed**:

- Add clear examples: "Call this when user mentions property price"
- Make required params very clear
- Add examples of input/output

### Issue 3: No Parameter Extraction

**Location**: Missing entirely

**Fix Needed**: Create `lib/extractors.ts` with regex patterns

### Issue 4: Full History Sent Every Time

**Location**: `app/api/chat/route.ts` → Line 114

**Current**: `state.messages.push({ role: 'user', content: message })`
Then sends ALL messages to Mistral

**Fix Needed**: Only send last 5-7 messages

### Issue 5: No Error Logging

**Location**: `app/api/chat/route.ts` → Error handling

**Current**: Errors are caught but not logged properly

**Fix Needed**: Better error logging to debug issues

### Issue 6: Streaming Logic Might Fail

**Location**: `app/api/chat/route.ts` → Lines 178-200

**Problem**: If Mistral API fails, streaming breaks

**Fix Needed**: Better error handling in streaming

---

## 📍 WHERE TO FIND THINGS

### System Prompts

**File**: `lib/mistral.ts`
**Function**: `getSystemPrompt(scenario)`
**Lines**: 163-214

### Tool Definitions

**File**: `lib/mistral.ts`
**Function**: `getAvailableTools(scenario)`
**Lines**: 58-158

### Math Functions

**File**: `lib/math.ts`
**Functions**: `calculateMortgage()`, `analyzeBuyVsRent()`, `calculateEMI()`

### API Endpoint

**File**: `app/api/chat/route.ts`
**Function**: `POST(request)`
**Lines**: 84-232

### Frontend Chat

**File**: `components/ChatInterface.tsx`
**Function**: `handleSubmit()`
**Lines**: 50-155

---

## 🎯 RECOMMENDED FIXES (Priority Order)

### Priority 1: Fix Function Calling

1. Strengthen system prompt to FORCE tool usage
2. Improve tool descriptions with examples
3. Add validation: if LLM doesn't call tool when it should, retry

### Priority 2: Add Parameter Extraction

1. Create `lib/extractors.ts` with regex patterns
2. Extract params BEFORE calling LLM
3. Use extracted params to decide if LLM is needed

### Priority 3: Optimize Token Usage

1. Only send last 5-7 messages to LLM
2. Include extracted params in context instead of full history
3. Cache system prompt (don't resend every time)

### Priority 4: Fix Error Handling

1. Add proper error logging
2. Handle Mistral API errors gracefully
3. Return helpful error messages to frontend

### Priority 5: Add Parameter Validation

1. Validate extracted parameters (reasonable ranges)
2. Check required params before tool execution
3. Return clear errors if validation fails

---

## 🚨 CRITICAL: Avoiding Hallucinations

### Current Protection ✅

- Math functions are deterministic (lib/math.ts)
- LLM never calculates numbers directly
- Tool results are always from math functions

### Missing Protection ❌

- No validation of LLM-extracted parameters
- LLM can still generate responses without tools
- No check if tool was called when it should be

### Needed Protection 🔧

1. **Backend extraction**: Use regex to extract numbers
2. **Validation**: Check if extracted params are reasonable
3. **Enforcement**: Force LLM to call tools, don't let it guess
4. **Fallback**: If LLM doesn't call tool, extract params ourselves and call tool

---

## 📝 NEXT STEPS

1. **Analyze this document** ✅ (You're here)
2. **Plan fixes** (Next step)
3. **Implement fixes** (After approval)
4. **Test thoroughly** (After implementation)

---

## ❓ QUESTIONS TO ANSWER

1. Should we add backend parameter extraction (regex) as suggested in flow.md?
2. How strict should we be about forcing tool usage? (Retry if LLM doesn't call tool?)
3. Should we cache extracted parameters across messages?
4. How many messages should we keep in context? (5? 7? 10?)
5. Should we add a "skip LLM" path if we have all params?
