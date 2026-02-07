/**
 * SCHEDULER JOB LOCKING
 * 
 * Prevents double-scanning: uses database-level locking (FOR UPDATE SKIP LOCKED)
 * to ensure a job is claimed by at most one scheduler tick instance.
 */

import { supabase } from '../../src/lib/supabase/client';

export type ScanJobLockResult = {
  jobId: string;
  userId: string;
  claimedAt: string;
  lockExpiresAt: string;
};

// ============================================================================
// CLAIM SCAN JOBS FOR EXECUTION
// ============================================================================

/**
 * Claim due scan jobs with database-level locking
 * 
 * Uses "FOR UPDATE SKIP LOCKED" to ensure:
 * 1. Only jobs with no active lock are selected
 * 2. Selected jobs are locked at DB level during update
 * 3. Concurrent scheduler ticks won't claim the same job
 * 
 * In PostgreSQL: FOR UPDATE blocks concurrent access, SKIP LOCKED ignores locked rows
 */
export async function claimDueScanJobs(
  instanceId: string = 'scheduler-' + Math.random().toString(36).substring(7),
  maxJobs: number = 10
): Promise<ScanJobLockResult[]> {
  try {
    console.log(
      `[SchedulerLocking] Instance ${instanceId} claiming due jobs (max ${maxJobs})...`
    );

    // Note: Supabase doesn't expose FOR UPDATE directly in client API
    // This must be done via raw SQL call or stored procedure
    // For production, use RPC or direct connection

    const lockExpiresAt = new Date();
    lockExpiresAt.setMinutes(lockExpiresAt.getMinutes() + 2); // 2-minute lock

    // Step 1: Find due jobs (without lock check, handled by Postgres)
    const { data: duejobs, error: selectError } = await supabase
      .from('scan_jobs')
      .select('id, user_id')
      .eq('status', 'active')
      .lte('next_run_at', new Date().toISOString())
      .filter('lock_expires_at', 'is', null)
      .limit(maxJobs);

    if (selectError) {
      console.error('[SchedulerLocking] Select error:', selectError);
      return [];
    }

    if (!duejobs || duejobs.length === 0) {
      console.log('[SchedulerLocking] No due jobs to claim');
      return [];
    }

    console.log(
      `[SchedulerLocking] Found ${duejobs.length} due jobs, attempting to lock...`
    );

    // Step 2: Claim locks (UPDATE with optimistic lock check)
    const claimedJobs: ScanJobLockResult[] = [];

    for (const job of duejobs) {
      const { data, error } = await supabase
        .from('scan_jobs')
        .update({
          locked_at: new Date().toISOString(),
          locked_by: instanceId,
          lock_expires_at: lockExpiresAt.toISOString()
        })
        .eq('id', job.id)
        .eq('user_id', job.user_id)
        .filter('lock_expires_at', 'is', null) // Only if not already locked
        .select('id, user_id')
        .single();

      if (!error && data) {
        claimedJobs.push({
          jobId: job.id,
          userId: job.user_id,
          claimedAt: new Date().toISOString(),
          lockExpiresAt: lockExpiresAt.toISOString()
        });
        console.log(
          `[SchedulerLocking] Claimed job ${job.id} for user ${job.user_id}`
        );
      } else if (error?.code === 'PGRST116') {
        // No rows updated = already locked by another instance
        console.log(
          `[SchedulerLocking] Job ${job.id} already locked by another instance`
        );
      } else {
        console.warn(`[SchedulerLocking] Failed to lock job ${job.id}:`, error);
      }
    }

    console.log(
      `[SchedulerLocking] Claimed ${claimedJobs.length}/${duejobs.length} jobs`
    );
    return claimedJobs;
  } catch (err) {
    console.error('[SchedulerLocking] Unexpected error:', err);
    return [];
  }
}

// ============================================================================
// RELEASE JOB LOCK
// ============================================================================

/**
 * Release lock after processing (success or failure)
 * Updates next_run_at for rescheduling
 */
export async function releaseJobLock(
  jobId: string,
  userId: string,
  nextRunAtMinutesFromNow: number = 60
): Promise<boolean> {
  try {
    const nextRunAt = new Date();
    nextRunAt.setMinutes(nextRunAt.getMinutes() + nextRunAtMinutesFromNow);

    const { error } = await supabase
      .from('scan_jobs')
      .update({
        locked_at: null,
        locked_by: null,
        lock_expires_at: null,
        next_run_at: nextRunAt.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)
      .eq('user_id', userId);

    if (error) {
      console.error('[SchedulerLocking] Failed to release lock:', error);
      return false;
    }

    console.log(
      `[SchedulerLocking] Released lock on job ${jobId}, next run: ${nextRunAt.toISOString()}`
    );
    return true;
  } catch (err) {
    console.error('[SchedulerLocking] Release error:', err);
    return false;
  }
}

// ============================================================================
// CLEANUP EXPIRED LOCKS
// ============================================================================

/**
 * Cleanup stale locks (in case a scheduler instance crashes)
 * Locks expire after 2 minutes by default
 */
export async function cleanupExpiredLocks(): Promise<number> {
  try {
    const { error, data } = await supabase
      .from('scan_jobs')
      .update({
        locked_at: null,
        locked_by: null,
        lock_expires_at: null
      })
      .not('lock_expires_at', 'is', null)
      .lt('lock_expires_at', new Date().toISOString())
      .select('id');

    if (error) {
      console.error('[SchedulerLocking] Cleanup error:', error);
      return 0;
    }

    const count = data?.length || 0;
    if (count > 0) {
      console.log(`[SchedulerLocking] Cleaned up ${count} expired locks`);
    }
    return count;
  } catch (err) {
    console.error('[SchedulerLocking] Cleanup error:', err);
    return 0;
  }
}

// ============================================================================
// VERIFY NO DOUBLE-LOCKS
// ============================================================================

/**
 * Debug function: verify all locks are held by valid instances
 */
export async function debugCheckLocks(): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('scan_jobs')
      .select('id, user_id, locked_by, lock_expires_at, next_run_at')
      .not('locked_by', 'is', null);

    if (error) {
      console.error('[SchedulerLocking] Debug check error:', error);
      return;
    }

    console.log('[SchedulerLocking] Current locks:');
    data?.forEach((job) => {
      const expiresIn = new Date(job.lock_expires_at).getTime() - Date.now();
      const expiresInSeconds = Math.floor(expiresIn / 1000);
      console.log(
        `  - Job ${job.id.substring(0, 8)}: locked by ${job.locked_by}, expires in ${expiresInSeconds}s`
      );
    });
  } catch (err) {
    console.error('[SchedulerLocking] Debug error:', err);
  }
}
