/**
 * TRADING AGENT TEST SUITE
 * 
 * Run tests:
 * npm run test:trading
 */

import { AITradingAgent, type AgentContext, type TradeSignal } from '../server/ai/tradingAgent';

// ============================================================================
// TEST DATA
// ============================================================================

const mockContext: AgentContext = {
  userId: 'test_user_123',
  profile: {
    riskProfile: 'gebalanceerd',
    maxDrawdown: 0.10,
    maxPositionSize: 0.20,
    allowedAssets: ['BTC', 'ETH', 'ADA', 'SOL']
  },
  market: {
    volatility: 45,
    sentiment: 62,
    recentObservations: [
      'Bitcoin surged 3.2% on Fed rate hold',
      'Ethereum outperforming after Shanghai upgrade',
      'Altcoins ranging sideways, awaiting direction'
    ]
  },
  portfolio: {
    totalValue: 10000,
    balances: [
      { asset: 'EUR', total: 5000 },
      { asset: 'BTC', total: 0.05 },
      { asset: 'ETH', total: 1.2 }
    ],
    openOrders: [],
    openPositions: [
      {
        asset: 'BTC',
        quantity: 0.05,
        entryPrice: 90000,
        currentPrice: 93000
      },
      {
        asset: 'ETH',
        quantity: 1.2,
        entryPrice: 2300,
        currentPrice: 2450
      }
    ]
  }
};

// ============================================================================
// TEST CASES
// ============================================================================

async function testAnalyzeMarket() {
  console.log('\n=== TEST 1: Analyze Market ===');
  
  try {
    const agent = new AITradingAgent();
    const signals = await agent.analyzeAndProposeTrades(mockContext);
    
    console.log('✓ Analysis completed');
    console.log(`  Generated ${signals.length} signals`);
    signals.forEach((s, idx) => {
      console.log(`  [${idx}] ${s.action.toUpperCase()} ${s.asset} @ confidence ${s.confidence}%`);
    });
    
    return { pass: true, signals };
  } catch (err) {
    console.error('✗ Test failed:', err);
    return { pass: false };
  }
}

function testValidateSignal() {
  console.log('\n=== TEST 2: Validate Signals ===');
  
  const agent = new AITradingAgent();
  const testSignals: { signal: TradeSignal; shouldPass: boolean }[] = [
    {
      signal: {
        action: 'buy',
        asset: 'BTC',
        quantity: 0.01,
        price: 95000,
        rationale: 'Valid test signal',
        confidence: 75,
        riskLevel: 'medium'
      },
      shouldPass: true
    },
    {
      signal: {
        action: 'buy',
        asset: 'INVALID',
        quantity: 0.01,
        price: 1000,
        rationale: 'Invalid asset',
        confidence: 75,
        riskLevel: 'medium'
      },
      shouldPass: false
    },
    {
      signal: {
        action: 'buy',
        asset: 'ETH',
        quantity: 100,
        price: 5000,
        rationale: 'Huge position, should fail',
        confidence: 75,
        riskLevel: 'high'
      },
      shouldPass: false
    }
  ];

  let passed = 0;
  let failed = 0;

  testSignals.forEach((test, idx) => {
    const validation = (agent as any).validateSignal(test.signal, mockContext);
    const isCorrect = validation.ok === test.shouldPass;
    
    if (isCorrect) {
      console.log(`  ✓ Signal ${idx + 1}: ${test.signal.action} ${test.signal.asset} - ${isCorrect ? 'OK' : 'FAIL'}`);
      passed++;
    } else {
      console.log(`  ✗ Signal ${idx + 1}: Expected ${test.shouldPass}, got ${validation.ok}`);
      if (validation.reason) console.log(`    Reason: ${validation.reason}`);
      failed++;
    }
  });

  console.log(`\n  Passed: ${passed}/${testSignals.length}`);
  return { pass: failed === 0, passed, failed };
}

function testPreflight() {
  console.log('\n=== TEST 3: Preflight Checks ===');
  
  const agent = new AITradingAgent();
  
  const testCases = [
    {
      name: 'Normal market conditions',
      context: { ...mockContext, market: { ...mockContext.market, volatility: 45 } },
      signal: {
        action: 'buy' as const,
        asset: 'BTC',
        quantity: 0.01,
        price: 95000,
        rationale: 'Test',
        confidence: 75,
        riskLevel: 'medium' as const
      },
      shouldPass: true
    },
    {
      name: 'High volatility',
      context: { ...mockContext, market: { ...mockContext.market, volatility: 90 } },
      signal: {
        action: 'buy' as const,
        asset: 'BTC',
        quantity: 0.01,
        price: 95000,
        rationale: 'Test',
        confidence: 75,
        riskLevel: 'medium' as const
      },
      shouldPass: false // Cannot buy at vol > 85
    },
    {
      name: 'Order too small',
      context: mockContext,
      signal: {
        action: 'buy' as const,
        asset: 'BTC',
        quantity: 0.0001,
        price: 95000,
        rationale: 'Too small',
        confidence: 75,
        riskLevel: 'low' as const
      },
      shouldPass: false
    }
  ];

  let passed = 0;
  testCases.forEach((test) => {
    const result = (agent as any).performPreflight(test.signal, test.context);
    const isCorrect = result.ok === test.shouldPass;
    
    console.log(`  ${isCorrect ? '✓' : '✗'} ${test.name}`);
    if (!isCorrect && result.reason) {
      console.log(`    Expected: ${test.shouldPass}, Got: ${result.ok}`);
      console.log(`    Reason: ${result.reason}`);
    }
    if (isCorrect) passed++;
  });

  console.log(`\n  Passed: ${passed}/${testCases.length}`);
  return { pass: passed === testCases.length, passed };
}

async function testExecuteBuy() {
  console.log('\n=== TEST 4: Execute Buy Order ===');
  
  try {
    const agent = new AITradingAgent();
    const signal: TradeSignal = {
      action: 'buy',
      asset: 'ADA',
      quantity: 100,
      price: 1.2,
      rationale: 'Testing buy execution',
      confidence: 50,
      riskLevel: 'medium'
    };

    const result = await (agent as any).executeBuyOrder(signal, mockContext, null, 'test_audit_1');
    
    console.log(`  ${result.success ? '✓' : '✗'} Buy order result`);
    console.log(`    Action: ${result.action}`);
    console.log(`    Asset: ${result.asset}`);
    console.log(`    Quantity: ${result.quantity}`);
    console.log(`    Price: €${result.price}`);
    console.log(`    Fee: €${result.fee}`);
    console.log(`    Total: €${result.totalValue}`);
    console.log(`    Message: ${result.message}`);

    return { pass: result.success };
  } catch (err) {
    console.error('  ✗ Test failed:', err);
    return { pass: false };
  }
}

async function testAuditTrail() {
  console.log('\n=== TEST 5: Audit Trail ===');
  
  try {
    const agent = new AITradingAgent();
    
    // Execute a test trade
    const signal: TradeSignal = {
      action: 'hold',
      asset: 'BTC',
      rationale: 'Testing audit trail',
      confidence: 100,
      riskLevel: 'low'
    };

    const result = await agent.executeTrade(signal, mockContext, null as any);
    
    // Get audit trail
    const trail = agent.getAuditTrail('test_user_123');
    
    console.log(`  ✓ Audit trail captured`);
    console.log(`    Trades logged: ${trail.length}`);
    trail.slice(-3).forEach((t) => {
      console.log(`      [${t.auditId}] ${t.action} ${t.asset} @ ${t.timestamp}`);
    });

    return { pass: trail.length > 0 };
  } catch (err) {
    console.error('  ✗ Test failed:', err);
    return { pass: false };
  }
}

// ============================================================================
// RUN ALL TESTS
// ============================================================================

async function runAllTests() {
  console.log('🤖 TRADING AGENT TEST SUITE');
  console.log('====================================\n');

  const results = {
    passed: 0,
    failed: 0
  };

  // Test 1
  const test1 = await testAnalyzeMarket();
  results[test1.pass ? 'passed' : 'failed']++;

  // Test 2
  const test2 = testValidateSignal();
  results[test2.pass ? 'passed' : 'failed']++;

  // Test 3
  const test3 = testPreflight();
  results[test3.pass ? 'passed' : 'failed']++;

  // Test 4
  const test4 = await testExecuteBuy();
  results[test4.pass ? 'passed' : 'failed']++;

  // Test 5
  const test5 = await testAuditTrail();
  results[test5.pass ? 'passed' : 'failed']++;

  // Summary
  console.log('\n====================================');
  console.log(`📊 RESULTS: ${results.passed} passed, ${results.failed} failed`);
  console.log(`${results.failed === 0 ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
}

// Run if called directly
runAllTests().catch(console.error);
