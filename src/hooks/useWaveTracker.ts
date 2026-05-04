import { useState, useEffect, useCallback } from "react";
import {
  fetchBTCDerivativesSnapshot,
  fetchOIHistory,
  fetchLongShortRatio,
  fetchFundingRateHistory,
  analyzeWave,
  type BTCDerivativesSnapshot,
  type OIDataPoint,
  type LongShortDataPoint,
  type FundingRateDataPoint,
  type WaveAnalysis,
} from "@/lib/btc-derivatives";

export interface WaveTrackerData {
  snapshot: BTCDerivativesSnapshot | null;
  oiHistory: OIDataPoint[];
  lsHistory: LongShortDataPoint[];
  fundingHistory: FundingRateDataPoint[];
  analysis: WaveAnalysis | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: number | null;
}

export function useWaveTracker(
  oiInterval: "5min" | "15min" | "30min" | "1h" | "4h" | "1d" = "1h"
) {
  const [data, setData] = useState<WaveTrackerData>({
    snapshot: null,
    oiHistory: [],
    lsHistory: [],
    fundingHistory: [],
    analysis: null,
    isLoading: true,
    error: null,
    lastUpdated: null,
  });

  const fetchAll = useCallback(async () => {
    setData((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      // 모든 데이터 병렬 조회
      const [snapshot, oiHistory, lsHistory, fundingHistory] = await Promise.all([
        fetchBTCDerivativesSnapshot(),
        fetchOIHistory(oiInterval, 168), // 7일분
        fetchLongShortRatio(oiInterval, 168),
        fetchFundingRateHistory(50), // ~16일분
      ]);

      // 파동 분석
      const analysis = analyzeWave(oiHistory, lsHistory, fundingHistory, snapshot);

      setData({
        snapshot,
        oiHistory,
        lsHistory,
        fundingHistory,
        analysis,
        isLoading: false,
        error: null,
        lastUpdated: Date.now(),
      });
    } catch (err: any) {
      setData((prev) => ({
        ...prev,
        isLoading: false,
        error: err.message || "Failed to fetch wave data",
      }));
    }
  }, [oiInterval]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return { ...data, refetch: fetchAll };
}
