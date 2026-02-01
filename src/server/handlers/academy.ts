import { Router, Request, Response } from 'express';
import { supabase } from '../supabase';
import { academyCurriculum } from '../../data/academyCurriculum';

const router = Router();

interface ModuleProgress {
  [moduleId: string]: boolean;
}

interface BadgeEarned {
  [badgeId: string]: boolean;
}

interface ProgressResponse {
  progress: ModuleProgress;
  badges: BadgeEarned;
}

/**
 * GET /api/academy/progress
 * Get user's module completion progress and earned badges
 */
router.get('/progress', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Fetch completed modules
    const { data: completedModules, error: progressError } = await supabase
      .from('academy_module_progress')
      .select('module_id')
      .eq('user_id', userId)
      .not('completed_at', 'is', null);

    if (progressError) throw progressError;

    // Fetch earned badges
    const { data: earnedBadges, error: badgesError } = await supabase
      .from('user_badges')
      .select('badge_id')
      .eq('user_id', userId);

    if (badgesError) throw badgesError;

    // Convert to maps
    const progress: ModuleProgress = {};
    const badges: BadgeEarned = {};

    completedModules?.forEach((item) => {
      progress[item.module_id] = true;
    });

    earnedBadges?.forEach((item) => {
      badges[item.badge_id] = true;
    });

    res.json({
      progress,
      badges
    } as ProgressResponse);
  } catch (error) {
    console.error('Error fetching progress:', error);
    res.status(500).json({ error: 'Failed to fetch progress' });
  }
});

/**
 * POST /api/academy/complete-module
 * Mark a module as completed and award badge if all modules in level done
 */
router.post('/complete-module', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { moduleId } = req.body as { moduleId: string };
    if (!moduleId) {
      return res.status(400).json({ error: 'moduleId required' });
    }

    // Find the module
    const module = academyCurriculum.find((m) => m.id === moduleId);
    if (!module) {
      return res.status(404).json({ error: 'Module not found' });
    }

    // Mark module as completed
    const { error: completeError } = await supabase
      .from('academy_module_progress')
      .upsert(
        {
          user_id: userId,
          module_id: moduleId,
          completed_at: new Date().toISOString()
        },
        { onConflict: 'user_id,module_id' }
      );

    if (completeError) throw completeError;

    // Check if all modules in this level are completed
    const modulesInLevel = academyCurriculum.filter((m) => m.level === module.level);
    const { data: completedInLevel } = await supabase
      .from('academy_module_progress')
      .select('module_id')
      .eq('user_id', userId)
      .in(
        'module_id',
        modulesInLevel.map((m) => m.id)
      )
      .not('completed_at', 'is', null);

    let newBadge = null;

    // If all modules done, award level badge
    if (completedInLevel && completedInLevel.length === modulesInLevel.length) {
      const levelBadgeId = `level-${module.level}-complete`;

      // Check if already earned
      const { data: existingBadge } = await supabase
        .from('user_badges')
        .select('id')
        .eq('user_id', userId)
        .eq('badge_id', levelBadgeId)
        .single();

      if (!existingBadge) {
        const { error: badgeError } = await supabase
          .from('user_badges')
          .insert({
            user_id: userId,
            badge_id: levelBadgeId,
            level: module.level
          });

        if (badgeError) throw badgeError;
        newBadge = levelBadgeId;
      }
    }

    // Fetch updated progress
    const { data: completedModules } = await supabase
      .from('academy_module_progress')
      .select('module_id')
      .eq('user_id', userId)
      .not('completed_at', 'is', null);

    const { data: earnedBadges } = await supabase
      .from('user_badges')
      .select('badge_id')
      .eq('user_id', userId);

    const progress: ModuleProgress = {};
    const badges: BadgeEarned = {};

    completedModules?.forEach((item) => {
      progress[item.module_id] = true;
    });

    earnedBadges?.forEach((item) => {
      badges[item.badge_id] = true;
    });

    res.json({
      progress,
      badges,
      newBadge
    });
  } catch (error) {
    console.error('Error completing module:', error);
    res.status(500).json({ error: 'Failed to complete module' });
  }
});

export default router;
