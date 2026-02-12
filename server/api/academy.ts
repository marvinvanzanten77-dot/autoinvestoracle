/**
 * Academy Routes - Learning content and modules
 */

import { Express, Request, Response } from 'express';
import { academyCurriculum } from '../../../src/data/academyCurriculum';
import { supabase } from '../../../src/lib/supabase/client';

export function setupAcademyRoutes(app: Express) {
  /**
   * GET /api/academy/modules
   * Get all available academy modules
   */
  app.get('/api/academy/modules', async (req: Request, res: Response) => {
    try {
      const level = req.query.level as string | undefined;

      let modules = academyCurriculum;

      if (level) {
        modules = modules.filter(m => m.level === level);
      }

      res.json({
        success: true,
        data: {
          modules: modules.map(m => ({
            id: m.id,
            title: m.title,
            description: m.description,
            level: m.level,
            lessonCount: m.lessons?.length || 0,
            estimatedHours: m.estimatedHours
          })),
          total: modules.length
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: String(error) }
      });
    }
  });

  /**
   * GET /api/academy/modules/:moduleId
   * Get specific module with lessons
   */
  app.get('/api/academy/modules/:moduleId', async (req: Request, res: Response) => {
    try {
      const { moduleId } = req.params;

      const module = academyCurriculum.find(m => m.id === moduleId);

      if (!module) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Module not found' }
        });
      }

      res.json({
        success: true,
        data: module
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: String(error) }
      });
    }
  });

  /**
   * GET /api/academy/lessons/:lessonId
   * Get specific lesson
   */
  app.get('/api/academy/lessons/:lessonId', async (req: Request, res: Response) => {
    try {
      const { lessonId } = req.params;

      for (const module of academyCurriculum) {
        const lesson = module.lessons?.find(l => l.id === lessonId);
        if (lesson) {
          return res.json({
            success: true,
            data: {
              ...lesson,
              moduleId: module.id,
              moduleName: module.title
            }
          });
        }
      }

      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Lesson not found' }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: String(error) }
      });
    }
  });

  /**
   * POST /api/academy/progress
   * Record user progress on a lesson
   */
  app.post('/api/academy/progress', async (req: Request, res: Response) => {
    try {
      const userId = req.query.userId as string;
      const { moduleId, lessonId, completed, score } = req.body;

      if (!userId || !moduleId || !lessonId) {
        return res.status(400).json({
          success: false,
          error: { code: 'MISSING_DATA', message: 'userId, moduleId, lessonId required' }
        });
      }

      // TODO: Store progress in database (would need academy_progress table)
      res.json({
        success: true,
        data: {
          userId,
          moduleId,
          lessonId,
          completed: completed || false,
          score: score || 0,
          recordedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: String(error) }
      });
    }
  });

  /**
   * GET /api/academy/progress
   * Get user's learning progress
   */
  app.get('/api/academy/progress', async (req: Request, res: Response) => {
    try {
      const userId = req.query.userId as string;

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: { code: 'MISSING_USER_ID', message: 'userId required' }
        });
      }

      // TODO: Query from database
      res.json({
        success: true,
        data: {
          userId,
          completedLessons: 0,
          totalLessons: academyCurriculum.reduce((sum, m) => sum + (m.lessons?.length || 0), 0),
          progress: 0,
          modules: []
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: String(error) }
      });
    }
  });

  /**
   * POST /api/academy/submit-quiz
   * Submit quiz answers
   */
  app.post('/api/academy/submit-quiz', async (req: Request, res: Response) => {
    try {
      const userId = req.query.userId as string;
      const { lessonId, answers } = req.body;

      if (!userId || !lessonId || !answers) {
        return res.status(400).json({
          success: false,
          error: { code: 'MISSING_DATA', message: 'userId, lessonId, answers required' }
        });
      }

      // Find lesson and score quiz
      let lesson: any;
      for (const module of academyCurriculum) {
        const found = module.lessons?.find(l => l.id === lessonId);
        if (found) {
          lesson = found;
          break;
        }
      }

      if (!lesson || !lesson.quiz) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Lesson or quiz not found' }
        });
      }

      // Score the quiz
      let score = 0;
      for (let i = 0; i < lesson.quiz.questions.length; i++) {
        if (answers[i] === lesson.quiz.questions[i].correctAnswerIndex) {
          score++;
        }
      }

      const percentage = (score / lesson.quiz.questions.length) * 100;
      const passed = percentage >= lesson.quiz.passingScore;

      res.json({
        success: true,
        data: {
          userId,
          lessonId,
          score,
          totalQuestions: lesson.quiz.questions.length,
          percentage,
          passed,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: String(error) }
      });
    }
  });
}
