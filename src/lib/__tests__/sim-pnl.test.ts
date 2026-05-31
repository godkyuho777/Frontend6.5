/**
 * sim-pnl.ts unit tests (P2-#15, 2026-05-23).
 *
 * 검증 목표:
 *   - PnL 공식 정확성 (LONG / SHORT, size × price diff)
 *   - ROE = pnl / marginUsed (leverage 무관 PnL 보장)
 *   - Margin Ratio 청산 임박도 (안전 / 경고 / 위험 / 청산)
 *   - SimulatorStats 집계 (winRate / expectancy / maxDD)
 *   - SLIPPAGE_PCT = 0 (모의투자 시장가 그대로)
 *
 * 헌장: sim-pnl 은 pure functions — store / localStorage 와 무관.
 *   본 테스트는 BBDX 시그널 무관 (Investment Simulator 의 모의투자 ROE 계산).
 */

import { describe, test, expect } from "vitest";
import {
  computeUnrealizedPnL,
  computeROE,
  computeMarginRatio,
  computeNetPnL,
  computeCashReturned,
  applySlippage,
  computeMaxDrawdown,
  computeSimulatorStats,
  emptySimulatorStats,
  estimateUserAvgReturnPct,
  getMarginRatioColor,
  aggregatePnLByGranularity,
  summarizePnLSeries,
  SLIPPAGE_PCT,
  DEFAULT_MAINTENANCE_MARGIN_RATE,
  BBDX_BASELINE,
  MIN_TRADES_FOR_COMPARISON,
} from "../sim-pnl";

// ─── computeUnrealizedPnL ────────────────────────────────────

describe("computeUnrealizedPnL", () => {
  test("LONG 가격 상승 = 양수 PnL", () => {
    // 0.125 BTC × ($80,800 - $80,000) = $100
    expect(computeUnrealizedPnL("long", 0.125, 80_000, 80_800)).toBeCloseTo(100, 6);
  });

  test("LONG 가격 하락 = 음수 PnL", () => {
    // 0.125 × (78_000 - 80_000) = -250
    expect(computeUnrealizedPnL("long", 0.125, 80_000, 78_000)).toBeCloseTo(-250, 6);
  });

  test("SHORT 가격 하락 = 양수 PnL", () => {
    // 0.125 × (80_000 - 78_000) = 250
    expect(computeUnrealizedPnL("short", 0.125, 80_000, 78_000)).toBeCloseTo(250, 6);
  });

  test("SHORT 가격 상승 = 음수 PnL", () => {
    expect(computeUnrealizedPnL("short", 0.125, 80_000, 81_000)).toBeCloseTo(-125, 6);
  });

  test("PnL 은 leverage 곱셈 없음 — $4T 자본 폭주 버그 회귀 방지 ⭐", () => {
    // 과거 버그: PnL 에 leverage 를 곱해 자본이 $4조까지 폭주.
    // 헌장: 절대 PnL = size × priceΔ 단 하나의 값. leverage 는 ROE 에만 반영.
    // 1 BTC, entry $80k, current $80.8k (+1%) → 정확히 $800 (1 × 800).
    const pnl = computeUnrealizedPnL("long", 1, 80_000, 80_800);
    expect(pnl).toBeCloseTo(800, 6);
    // leverage 가 곱해졌다면 8_000(10x) / 80_000(100x) 이 나왔을 것 — 절대 아님.
    expect(pnl).not.toBeCloseTo(8_000, 2);
    expect(pnl).not.toBeCloseTo(80_000, 2);
  });

  test("size=0 → 0 반환", () => {
    expect(computeUnrealizedPnL("long", 0, 80_000, 81_000)).toBe(0);
  });

  test("음수 size 가드 → 0 반환", () => {
    expect(computeUnrealizedPnL("long", -1, 80_000, 81_000)).toBe(0);
  });

  test("0 이하 가격 가드 → 0 반환", () => {
    expect(computeUnrealizedPnL("long", 0.1, 0, 81_000)).toBe(0);
    expect(computeUnrealizedPnL("long", 0.1, 80_000, 0)).toBe(0);
  });
});

// ─── computeROE ──────────────────────────────────────────────

describe("computeROE", () => {
  test("LONG 10x: 1% 가격 상승 → +10% ROE", () => {
    // margin $1000, size 0.125 BTC, entry 80_000
    // +1% 가격 (80_800) → pnl = $100 → roe = 0.1
    const roe = computeROE("long", 0.125, 80_000, 80_800, 1000);
    expect(roe).toBeCloseTo(0.1, 6);
  });

  test("LONG 10% 가격 하락 → -100% ROE (청산 임계)", () => {
    // pnl = 0.125 × (72_000 - 80_000) = -1000 → roe = -1
    expect(computeROE("long", 0.125, 80_000, 72_000, 1000)).toBeCloseTo(-1, 6);
  });

  test("SHORT 5x: 2% 가격 하락 → +10% ROE", () => {
    // margin $2000, size 0.25 BTC (5x), entry 80_000
    // -2% 가격 (78_400) → pnl = 0.25 × 1600 = 400 → roe = 0.2
    expect(computeROE("short", 0.25, 80_000, 78_400, 2000)).toBeCloseTo(0.2, 6);
  });

  test("margin=0 → 0 (0 division 가드)", () => {
    expect(computeROE("long", 0.1, 80_000, 81_000, 0)).toBe(0);
  });

  test("음수 margin 가드 → 0", () => {
    expect(computeROE("long", 0.1, 80_000, 81_000, -100)).toBe(0);
  });
});

// ─── computeMarginRatio ──────────────────────────────────────

describe("computeMarginRatio", () => {
  test("LONG 안전 상태 — 가격 상승 → margin ratio 낮음", () => {
    // size 0.125 BTC, entry 80_000, current 80_800, margin 1000
    // pnl = 100, currentMargin = 1100
    // maintenance = 0.125 × 80_800 × 0.005 = 50.5
    // ratio = 50.5 / 1100 ≈ 0.0459
    const ratio = computeMarginRatio("long", 0.125, 80_000, 80_800, 1000);
    expect(ratio).toBeGreaterThan(0);
    expect(ratio).toBeLessThan(0.1);
  });

  test("LONG 위험 — 가격 -8% → ratio 0.5 이상", () => {
    // size 0.125, entry 80_000, current 73_600 (-8%), margin 1000
    // pnl = -800, currentMargin = 200
    // maintenance = 0.125 × 73_600 × 0.005 = 46
    // ratio = 46 / 200 = 0.23 — 아직은 위험 단계 도달 X
    // -9% 부터 ratio 급등.
    const ratio = computeMarginRatio("long", 0.125, 80_000, 73_600, 1000);
    expect(ratio).toBeGreaterThan(0);
  });

  test("currentMargin <= 0 시 Infinity (사실상 청산)", () => {
    // pnl = -1000 으로 currentMargin = 0
    const ratio = computeMarginRatio("long", 0.125, 80_000, 72_000, 1000);
    expect(ratio).toBe(Infinity);
  });

  test("size=0 → 0 반환", () => {
    expect(computeMarginRatio("long", 0, 80_000, 80_000, 1000)).toBe(0);
  });

  test("custom maintenance rate 적용", () => {
    // rate 0 → maintenance 0 → ratio 0
    const ratio = computeMarginRatio("long", 0.125, 80_000, 80_000, 1000, 0);
    expect(ratio).toBe(0);
  });
});

// ─── getMarginRatioColor ─────────────────────────────────────

describe("getMarginRatioColor", () => {
  test("ratio < 0.5 → 안전 (muted)", () => {
    expect(getMarginRatioColor(0.2)).toBe("text-muted-foreground");
  });

  test("ratio 0.5~0.8 → 경고 (yellow)", () => {
    expect(getMarginRatioColor(0.6)).toBe("text-neon-yellow");
  });

  test("ratio >= 0.8 → 위험 (red bold)", () => {
    expect(getMarginRatioColor(0.9)).toBe("text-neon-red font-bold");
    expect(getMarginRatioColor(1.5)).toBe("text-neon-red font-bold");
  });

  test("Infinity → 안전 색 (계산 불가)", () => {
    expect(getMarginRatioColor(Infinity)).toBe("text-muted-foreground");
  });
});

// ─── computeNetPnL / computeCashReturned ─────────────────────

describe("computeNetPnL", () => {
  test("commission + funding 차감", () => {
    expect(computeNetPnL(100, 5, 2)).toBe(93);
  });

  test("음수 funding (수령) 은 net 증가 — 헌장: 호출자가 부호 보장", () => {
    // accruedFunding 가 음수면 -(-5) = +5 가 net 에 더해짐
    expect(computeNetPnL(100, 5, -5)).toBe(100); // 100 - 5 - (-5) = 100
  });
});

describe("computeCashReturned", () => {
  test("normal 이익 — margin + netPnL", () => {
    expect(computeCashReturned(1000, 250)).toBe(1250);
  });

  test("margin 이상 손실 — 0 clamp (auto-deleverage 시뮬레이션)", () => {
    expect(computeCashReturned(1000, -1500)).toBe(0);
  });

  test("정확히 margin 만큼 손실 → 0", () => {
    expect(computeCashReturned(1000, -1000)).toBe(0);
  });
});

// ─── computeMaxDrawdown ──────────────────────────────────────

describe("computeMaxDrawdown", () => {
  test("빈 array → 0", () => {
    const r = computeMaxDrawdown([], 200_000);
    expect(r.maxDrawdown).toBe(0);
    expect(r.maxDrawdownPct).toBe(0);
  });

  test("연속 이익 → drawdown 0", () => {
    const r = computeMaxDrawdown([100, 200, 300], 200_000);
    expect(r.maxDrawdown).toBe(0);
  });

  test("peak 이후 손실 → peak - trough", () => {
    // initial 200_000, +5000 → 205_000 peak, -8000 → 197_000
    // DD = 8000
    const r = computeMaxDrawdown([5000, -8000], 200_000);
    expect(r.maxDrawdown).toBe(8000);
    expect(r.maxDrawdownPct).toBeCloseTo(8000 / 205_000, 6);
  });

  test("여러 peak 이후 더 큰 DD 갱신", () => {
    // 200_000 + 1000 = 201_000 peak1
    // -500 = 200_500
    // +2000 = 202_500 peak2
    // -3000 = 199_500  DD = 3000 (from peak2)
    // +500 = 200_000
    // -5000 = 195_000  DD = 7500 (from peak2)
    const r = computeMaxDrawdown([1000, -500, 2000, -3000, 500, -5000], 200_000);
    expect(r.maxDrawdown).toBe(7500);
    expect(r.maxDrawdownPct).toBeCloseTo(7500 / 202_500, 6);
  });
});

// ─── computeSimulatorStats ───────────────────────────────────

describe("computeSimulatorStats", () => {
  test("빈 array → emptyStats", () => {
    const s = computeSimulatorStats([], 200_000);
    expect(s).toEqual(emptySimulatorStats());
  });

  test("3 win + 2 loss 기본 집계", () => {
    const closed = [
      { closedPnl: 100, closedAt: "2026-01-01" },
      { closedPnl: 200, closedAt: "2026-01-02" },
      { closedPnl: -50, closedAt: "2026-01-03" },
      { closedPnl: 300, closedAt: "2026-01-04" },
      { closedPnl: -100, closedAt: "2026-01-05" },
    ];
    const s = computeSimulatorStats(closed, 200_000);
    expect(s.totalTrades).toBe(5);
    expect(s.wins).toBe(3);
    expect(s.losses).toBe(2);
    expect(s.winRate).toBeCloseTo(0.6, 6);
    expect(s.avgWin).toBeCloseTo(200, 6);
    expect(s.avgLoss).toBeCloseTo(-75, 6);
    // expectancy = 0.6 × 200 + 0.4 × (-75) = 120 - 30 = 90
    expect(s.expectancy).toBeCloseTo(90, 6);
    expect(s.totalPnl).toBeCloseTo(450, 6);
    expect(s.totalPnlPct).toBeCloseTo(450 / 200_000, 6);
  });

  test("closedPnl null 항목 필터됨", () => {
    const closed = [
      { closedPnl: 100, closedAt: "2026-01-01" },
      { closedPnl: null, closedAt: "2026-01-02" }, // 필터 대상
      { closedPnl: -50, closedAt: "2026-01-03" },
    ];
    const s = computeSimulatorStats(closed, 200_000);
    expect(s.totalTrades).toBe(2);
  });

  test("Date 객체와 ISO string 동시 사용 — 정렬 일관성", () => {
    const closed = [
      { closedPnl: 100, closedAt: new Date("2026-01-01") },
      { closedPnl: -50, closedAt: "2026-01-02" },
    ];
    const s = computeSimulatorStats(closed, 200_000);
    expect(s.totalTrades).toBe(2);
    expect(s.totalPnl).toBe(50);
  });

  test("초기 자본 0 → totalPnlPct=0 (0 division 가드)", () => {
    const closed = [{ closedPnl: 100, closedAt: "2026-01-01" }];
    const s = computeSimulatorStats(closed, 0);
    expect(s.totalPnlPct).toBe(0);
  });
});

// ─── estimateUserAvgReturnPct ────────────────────────────────

describe("estimateUserAvgReturnPct", () => {
  test("expectancy / (initial × 0.01) — 1% margin proxy", () => {
    // initial 200_000 → margin proxy 2000
    // expectancy 100 → 100 / 2000 = 0.05 (5%)
    expect(estimateUserAvgReturnPct(100, 200_000)).toBeCloseTo(0.05, 6);
  });

  test("initial=0 → 0", () => {
    expect(estimateUserAvgReturnPct(100, 0)).toBe(0);
  });
});

// ─── applySlippage ───────────────────────────────────────────

describe("applySlippage (SLIPPAGE_PCT = 0)", () => {
  test("default rate 0 — 가격 그대로 (모의투자 시장가 정책)", () => {
    expect(applySlippage(80_000, "long")).toBe(80_000);
    expect(applySlippage(80_000, "short")).toBe(80_000);
  });

  test("explicit rate 0.001 — LONG 은 상승", () => {
    // 80_000 × 1.001 = 80_080
    expect(applySlippage(80_000, "long", 0.001)).toBeCloseTo(80_080, 6);
  });

  test("explicit rate 0.001 — SHORT 는 하락", () => {
    // 80_000 × 0.999 = 79_920
    expect(applySlippage(80_000, "short", 0.001)).toBeCloseTo(79_920, 6);
  });

  test("0 이하 가격 — 그대로 반환", () => {
    expect(applySlippage(0, "long")).toBe(0);
    expect(applySlippage(-100, "long")).toBe(-100);
  });
});

// ─── 정책 상수 ────────────────────────────────────────────────

describe("policy constants", () => {
  test("SLIPPAGE_PCT = 0 (시장가 그대로)", () => {
    expect(SLIPPAGE_PCT).toBe(0);
  });

  test("DEFAULT_MAINTENANCE_MARGIN_RATE = 0.005 (Bybit isolated 기본)", () => {
    expect(DEFAULT_MAINTENANCE_MARGIN_RATE).toBe(0.005);
  });

  test("BBDX_BASELINE 형식 검증", () => {
    expect(BBDX_BASELINE.winRate).toBeGreaterThan(0);
    expect(BBDX_BASELINE.winRate).toBeLessThanOrEqual(1);
    expect(BBDX_BASELINE.totalTrades).toBeGreaterThan(0);
    expect(BBDX_BASELINE.maxDrawdownPct).toBeLessThan(0); // 음수 (DD 는 손실)
    expect(BBDX_BASELINE.period).toContain("BTCUSDT");
  });

  test("MIN_TRADES_FOR_COMPARISON = 5 (통계적 의미 임계)", () => {
    expect(MIN_TRADES_FOR_COMPARISON).toBe(5);
  });
});

// ─── aggregatePnLByGranularity ───────────────────────────────

describe("aggregatePnLByGranularity", () => {
  test("빈 array → []", () => {
    expect(aggregatePnLByGranularity([], "day")).toEqual([]);
  });

  test("day bucket — 같은 날 거래 합산 + tradeCount", () => {
    const positions = [
      { closedPnl: 100, closedAt: "2026-05-15T01:00:00" },
      { closedPnl: 50, closedAt: "2026-05-15T20:00:00" },
      { closedPnl: -30, closedAt: "2026-05-16T10:00:00" },
    ];
    const out = aggregatePnLByGranularity(positions, "day");
    expect(out).toHaveLength(2);
    expect(out[0].bucket).toBe("2026-05-15");
    expect(out[0].pnl).toBeCloseTo(150, 6); // 100 + 50
    expect(out[0].tradeCount).toBe(2);
    expect(out[1].bucket).toBe("2026-05-16");
    expect(out[1].pnl).toBeCloseTo(-30, 6);
    expect(out[1].tradeCount).toBe(1);
  });

  test("cumulative PnL 누적 정확", () => {
    const positions = [
      { closedPnl: 100, closedAt: "2026-05-15T01:00:00" },
      { closedPnl: -30, closedAt: "2026-05-16T10:00:00" },
      { closedPnl: 200, closedAt: "2026-05-17T10:00:00" },
    ];
    const out = aggregatePnLByGranularity(positions, "day");
    expect(out.map((d) => d.cumulativePnl)).toEqual([100, 70, 270]);
  });

  test("입력이 뒤섞여도 시간 오름차순 정렬", () => {
    const positions = [
      { closedPnl: 200, closedAt: "2026-05-17T10:00:00" },
      { closedPnl: 100, closedAt: "2026-05-15T01:00:00" },
      { closedPnl: -30, closedAt: "2026-05-16T10:00:00" },
    ];
    const out = aggregatePnLByGranularity(positions, "day");
    expect(out.map((d) => d.bucket)).toEqual([
      "2026-05-15",
      "2026-05-16",
      "2026-05-17",
    ]);
  });

  test("month bucket — 같은 달 합산 (YYYY-MM)", () => {
    const positions = [
      { closedPnl: 100, closedAt: "2026-05-01T00:00:00" },
      { closedPnl: 50, closedAt: "2026-05-28T00:00:00" },
      { closedPnl: -20, closedAt: "2026-06-02T00:00:00" },
    ];
    const out = aggregatePnLByGranularity(positions, "month");
    expect(out).toHaveLength(2);
    expect(out[0].bucket).toBe("2026-05");
    expect(out[0].pnl).toBeCloseTo(150, 6);
    expect(out[1].bucket).toBe("2026-06");
  });

  test("week bucket — ISO week 키 형식 (YYYY-Www)", () => {
    const out = aggregatePnLByGranularity(
      [{ closedPnl: 100, closedAt: "2026-05-15T00:00:00" }],
      "week",
    );
    expect(out).toHaveLength(1);
    expect(out[0].bucket).toMatch(/^\d{4}-W\d{2}$/);
  });

  test("closedPnl null / closedAt null 항목 skip", () => {
    const positions = [
      { closedPnl: 100, closedAt: "2026-05-15T00:00:00" },
      { closedPnl: null, closedAt: "2026-05-15T00:00:00" },
      { closedPnl: 50, closedAt: null },
    ];
    const out = aggregatePnLByGranularity(positions, "day");
    expect(out).toHaveLength(1);
    expect(out[0].pnl).toBe(100);
    expect(out[0].tradeCount).toBe(1);
  });

  test("NaN / Infinity closedPnl skip → 유효 항목 없으면 []", () => {
    const positions = [
      { closedPnl: NaN, closedAt: "2026-05-15T00:00:00" },
      { closedPnl: Infinity, closedAt: "2026-05-16T00:00:00" },
    ];
    expect(aggregatePnLByGranularity(positions, "day")).toEqual([]);
  });

  test("Date 객체 closedAt 도 허용", () => {
    const out = aggregatePnLByGranularity(
      [{ closedPnl: 100, closedAt: new Date("2026-05-15T00:00:00") }],
      "day",
    );
    expect(out).toHaveLength(1);
    expect(out[0].pnl).toBe(100);
  });
});

// ─── summarizePnLSeries ──────────────────────────────────────

describe("summarizePnLSeries", () => {
  test("빈 array → null best/worst, 0 합계", () => {
    const s = summarizePnLSeries([]);
    expect(s.totalPnl).toBe(0);
    expect(s.bestPeriod).toBeNull();
    expect(s.worstPeriod).toBeNull();
    expect(s.avgPnl).toBe(0);
    expect(s.totalTrades).toBe(0);
  });

  test("best / worst / avg / totalTrades 계산", () => {
    const data = aggregatePnLByGranularity(
      [
        { closedPnl: 100, closedAt: "2026-05-15T00:00:00" },
        { closedPnl: -50, closedAt: "2026-05-16T00:00:00" },
        { closedPnl: 200, closedAt: "2026-05-17T00:00:00" },
      ],
      "day",
    );
    const s = summarizePnLSeries(data);
    expect(s.bestPeriod?.pnl).toBe(200);
    expect(s.worstPeriod?.pnl).toBe(-50);
    expect(s.totalTrades).toBe(3);
    // totalPnl = 최종 cumulative = 100 - 50 + 200 = 250
    expect(s.totalPnl).toBeCloseTo(250, 6);
    expect(s.avgPnl).toBeCloseTo(250 / 3, 6);
  });
});
