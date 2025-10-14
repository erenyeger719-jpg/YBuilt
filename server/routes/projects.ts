import { Router, Request, Response } from "express";
import { z } from "zod";
import { storage } from "../storage.js";
import { authMiddleware } from "../middleware/auth.js";
import { logger } from "../index.js";
import { Database } from "../db.js";

export default function projectsRoutes(db: Database) {
  const router = Router();

// Validation schemas
const createProjectSchema = z.object({
  prompt: z.string().min(1).max(5000),
  templateId: z.string().optional(),
});

const addCollaboratorSchema = z.object({
  userId: z.string(),
  role: z.enum(["owner", "editor", "viewer"]),
});

const createCommitSchema = z.object({
  message: z.string().min(1).max(500),
  changes: z.object({
    files: z.array(z.any()),
    diff: z.any(),
  }),
  parentCommitId: z.string().optional(),
});

/**
 * POST /api/projects
 * Create a new project
 */
router.post("/", authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const validatedData = createProjectSchema.parse(req.body);

    const project = await storage.createJob({
      userId: String(req.user.id),
      prompt: validatedData.prompt,
      templateId: validatedData.templateId,
    });

    logger.info(`[PROJECT] Created project ${project.id} for user ${req.user.id}`);

    res.status(201).json({
      id: project.id,
      userId: project.userId,
      prompt: project.prompt,
      status: project.status,
      createdAt: project.createdAt,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Validation failed",
        details: error.errors,
      });
    }

    logger.error("Create project error:", error);
    res.status(500).json({ error: "Failed to create project" });
  }
});

/**
 * GET /api/projects
 * Get all projects for the authenticated user
 */
router.get("/", authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const projects = await storage.getUserJobs(String(req.user.id));

    res.status(200).json({
      projects: projects.map(p => ({
        id: p.id,
        userId: p.userId,
        prompt: p.prompt,
        status: p.status,
        templateId: p.templateId,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
    });
  } catch (error) {
    logger.error("Get projects error:", error);
    res.status(500).json({ error: "Failed to get projects" });
  }
});

/**
 * GET /api/projects/:projectId/collaborators
 * Get all collaborators for a project
 */
router.get("/:projectId/collaborators", authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { projectId } = req.params;
    const collaborators = await storage.getCollaborators(projectId);

    res.status(200).json({ collaborators });
  } catch (error) {
    logger.error("Get collaborators error:", error);
    res.status(500).json({ error: "Failed to get collaborators" });
  }
});

/**
 * POST /api/projects/:projectId/collaborators
 * Add a collaborator to a project
 */
router.post("/:projectId/collaborators", authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { projectId } = req.params;
    const validatedData = addCollaboratorSchema.parse(req.body);

    // Check if current user owns the project
    const project = await storage.getJob(projectId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    if (project.userId !== String(req.user.id)) {
      // Check if user is at least an editor
      const collaborators = await storage.getCollaborators(projectId);
      const userCollab = collaborators.find(c => c.userId === String(req.user!.id));
      
      if (!userCollab || (userCollab.role !== "owner" && userCollab.role !== "editor")) {
        return res.status(403).json({ error: "Forbidden: Only project owners/editors can add collaborators" });
      }
    }
    
    const collaborator = await storage.addCollaborator(
      projectId,
      validatedData.userId,
      validatedData.role
    );

    logger.info(`[COLLAB] User ${validatedData.userId} added to project ${projectId} as ${validatedData.role}`);

    res.status(201).json({ collaborator });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Validation failed",
        details: error.errors,
      });
    }

    logger.error("Add collaborator error:", error);
    res.status(500).json({ error: "Failed to add collaborator" });
  }
});

/**
 * DELETE /api/projects/:projectId/collaborators/:userId
 * Remove a collaborator from a project
 */
router.delete("/:projectId/collaborators/:userId", authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { projectId, userId } = req.params;

    // Check if current user owns the project
    const project = await storage.getJob(projectId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    if (project.userId !== String(req.user.id)) {
      return res.status(403).json({ error: "Forbidden: Only project owners can remove collaborators" });
    }
    
    await storage.removeCollaborator(projectId, userId);

    logger.info(`[COLLAB] User ${userId} removed from project ${projectId}`);

    res.status(200).json({ message: "Collaborator removed successfully" });
  } catch (error) {
    logger.error("Remove collaborator error:", error);
    res.status(500).json({ error: "Failed to remove collaborator" });
  }
});

/**
 * GET /api/projects/:projectId/commits
 * Get commit history for a project
 */
router.get("/:projectId/commits", authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { projectId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;

    const commits = await storage.getCommits(projectId, limit);

    res.status(200).json({ commits });
  } catch (error) {
    logger.error("Get commits error:", error);
    res.status(500).json({ error: "Failed to get commits" });
  }
});

/**
 * POST /api/projects/:projectId/commits
 * Create a new commit (version snapshot)
 */
router.post("/:projectId/commits", authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { projectId } = req.params;
    const validatedData = createCommitSchema.parse(req.body);

    // Check if user has access to the project
    const project = await storage.getJob(projectId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // User must be owner or editor to create commits
    if (project.userId !== String(req.user.id)) {
      const collaborators = await storage.getCollaborators(projectId);
      const userCollab = collaborators.find(c => c.userId === String(req.user!.id));
      
      if (!userCollab || (userCollab.role !== "owner" && userCollab.role !== "editor")) {
        return res.status(403).json({ error: "Forbidden: Only project owners/editors can create commits" });
      }
    }

    const commit = await storage.createCommit({
      projectId,
      userId: String(req.user.id),
      message: validatedData.message,
      changes: validatedData.changes,
      parentCommitId: validatedData.parentCommitId || null,
    });

    logger.info(`[VERSION] Commit ${commit.id} created for project ${projectId} by user ${req.user.id}`);

    res.status(201).json({ commit });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Validation failed",
        details: error.errors,
      });
    }

    logger.error("Create commit error:", error);
    res.status(500).json({ error: "Failed to create commit" });
  }
});

/**
 * GET /api/projects/user/:userId
 * Get all projects for a user (their own + collaborations)
 */
router.get("/user/:userId", authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Only allow users to get their own projects
    if (String(req.user.id) !== req.params.userId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const projects = await storage.getUserJobs(req.params.userId);

    res.status(200).json({ projects });
  } catch (error) {
    logger.error("Get user projects error:", error);
    res.status(500).json({ error: "Failed to get user projects" });
  }
});

  return router;
}
