import { useState, useCallback } from 'react';
import type { ProgressUpdate } from '../components/ProgressIndicator';

export function useProgressTracking() {
  const [updates, setUpdates] = useState<ProgressUpdate[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  const startProgress = useCallback((title?: string) => {
    setUpdates([
      {
        stage: title || 'Voortgang',
        progress: 0,
        message: 'Voorbereiding...',
        status: 'pending'
      }
    ]);
    setIsVisible(true);
  }, []);

  const addUpdate = useCallback((
    stage: string,
    message: string,
    progress: number,
    status: 'pending' | 'processing' | 'success' | 'error' = 'processing',
    details?: string
  ) => {
    setUpdates((prev) => [
      ...prev,
      {
        stage,
        message,
        progress,
        status,
        details
      }
    ]);
  }, []);

  const updateLatest = useCallback((
    updates: Partial<ProgressUpdate>
  ) => {
    setUpdates((prev) => {
      if (prev.length === 0) return prev;
      const lastUpdate = prev[prev.length - 1];
      return [
        ...prev.slice(0, -1),
        { ...lastUpdate, ...updates }
      ];
    });
  }, []);

  const finalize = useCallback((success: boolean, message?: string) => {
    setUpdates((prev) => {
      if (prev.length === 0) return prev;
      const lastUpdate = prev[prev.length - 1];
      return [
        ...prev.slice(0, -1),
        {
          ...lastUpdate,
          progress: 100,
          status: success ? 'success' : 'error',
          message: message || (success ? 'Voltooid' : 'Mislukt'),
        }
      ];
    });

    // Auto-hide after 5 seconds if success
    if (success) {
      setTimeout(() => setIsVisible(false), 5000);
    }
  }, []);

  const reset = useCallback(() => {
    setUpdates([]);
    setIsVisible(false);
  }, []);

  return {
    updates,
    isVisible,
    startProgress,
    addUpdate,
    updateLatest,
    finalize,
    reset
  };
}
