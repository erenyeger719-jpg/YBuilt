import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { get, all, run } from '../db/sqlite.js';
import { authRequired } from '../middleware/auth.js';
import { logger } from '../middleware/logging.js';

const router = Router();

// Validation schemas
const createProjectSchema = z.object({
  name: z.string().min(1).max(255),
  content: z.string().max(1000000).optional(), // Max 1MB
});

const updateProjectSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  content: z.string().max(1000000).optional(),
});

/**
 * GET /api/projects
 * Get all projects for authenticated user
 */
router.get('/', authRequired, (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const projects = all<{
      id: number;
      user_id: number;
      name: string;
      content: string;
      created_at: string;
      updated_at: string;
    }>(
      'SELECT id, user_id, name, content, created_at, updated_at FROM projects WHERE user_id = ? ORDER BY updated_at DESC',
      [req.user.id]
    );

    res.status(200).json({
      projects: projects.map(p => ({
        id: p.id,
        userId: p.user_id,
        name: p.name,
        content: p.content,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      })),
    });
  } catch (error) {
    logger.error({ error }, 'Get projects error');
    res.status(500).json({ error: 'Failed to get projects' });
  }
});

/**
 * POST /api/projects
 * Create a new project
 */
router.post('/', authRequired, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const validatedData = createProjectSchema.parse(req.body);

    const result = run(
      'INSERT INTO projects (user_id, name, content) VALUES (?, ?, ?)',
      [req.user.id, validatedData.name, validatedData.content || '']
    );

    const projectId = Number(result.lastInsertRowid);

    const project = get<{
      id: number;
      user_id: number;
      name: string;
      content: string;
      created_at: string;
      updated_at: string;
    }>(
      'SELECT id, user_id, name, content, created_at, updated_at FROM projects WHERE id = ?',
      [projectId]
    );

    if (!project) {
      throw new Error('Failed to create project');
    }

    logger.info({ projectId, userId: req.user.id }, 'Project created');

    res.status(201).json({
      id: project.id,
      userId: project.user_id,
      name: project.name,
      content: project.content,
      createdAt: project.created_at,
      updatedAt: project.updated_at,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      });
    }

    logger.error({ error }, 'Create project error');
    res.status(500).json({ error: 'Failed to create project' });
  }
});

/**
 * GET /api/projects/:id
 * Get a specific project
 */
router.get('/:id', authRequired, (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const projectId = parseInt(req.params.id, 10);

    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    const project = get<{
      id: number;
      user_id: number;
      name: string;
      content: string;
      created_at: string;
      updated_at: string;
    }>(
      'SELECT id, user_id, name, content, created_at, updated_at FROM projects WHERE id = ?',
      [projectId]
    );

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check ownership
    if (project.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    res.status(200).json({
      id: project.id,
      userId: project.user_id,
      name: project.name,
      content: project.content,
      createdAt: project.created_at,
      updatedAt: project.updated_at,
    });
  } catch (error) {
    logger.error({ error }, 'Get project error');
    res.status(500).json({ error: 'Failed to get project' });
  }
});

/**
 * PUT /api/projects/:id
 * Update a project
 */
router.put('/:id', authRequired, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const projectId = parseInt(req.params.id, 10);

    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    const validatedData = updateProjectSchema.parse(req.body);

    // Check if project exists and user owns it
    const project = get<{ id: number; user_id: number }>(
      'SELECT id, user_id FROM projects WHERE id = ?',
      [projectId]
    );

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (project.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Build update query dynamically
    const updates: string[] = [];
    const params: any[] = [];

    if (validatedData.name !== undefined) {
      updates.push('name = ?');
      params.push(validatedData.name);
    }

    if (validatedData.content !== undefined) {
      updates.push('content = ?');
      params.push(validatedData.content);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    // Always update updated_at
    updates.push("updated_at = datetime('now')");
    params.push(projectId);

    run(
      `UPDATE projects SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    // Get updated project
    const updatedProject = get<{
      id: number;
      user_id: number;
      name: string;
      content: string;
      created_at: string;
      updated_at: string;
    }>(
      'SELECT id, user_id, name, content, created_at, updated_at FROM projects WHERE id = ?',
      [projectId]
    );

    logger.info({ projectId, userId: req.user.id }, 'Project updated');

    res.status(200).json({
      id: updatedProject!.id,
      userId: updatedProject!.user_id,
      name: updatedProject!.name,
      content: updatedProject!.content,
      createdAt: updatedProject!.created_at,
      updatedAt: updatedProject!.updated_at,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      });
    }

    logger.error({ error }, 'Update project error');
    res.status(500).json({ error: 'Failed to update project' });
  }
});

/**
 * DELETE /api/projects/:id
 * Delete a project
 */
router.delete('/:id', authRequired, (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const projectId = parseInt(req.params.id, 10);

    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    // Check if project exists and user owns it
    const project = get<{ id: number; user_id: number }>(
      'SELECT id, user_id FROM projects WHERE id = ?',
      [projectId]
    );

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (project.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    run('DELETE FROM projects WHERE id = ?', [projectId]);

    logger.info({ projectId, userId: req.user.id }, 'Project deleted');

    res.status(204).send();
  } catch (error) {
    logger.error({ error }, 'Delete project error');
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

export default router;
