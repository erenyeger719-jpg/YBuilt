// server/ai/subrouters.ts
import { Router } from "express";

import { setupReviewRoutes } from "./router.review.ts";
import { setupComposeRoutes } from "./router.compose.ts";
import { setupMediaRoutes } from "./router.media.ts";
import { setupMetricsRoutes } from "./router.metrics.ts";

export const reviewRouter = Router();
export const composeRouter = Router();
export const mediaRouter = Router();
export const metricsRouter = Router();

// Wire routes onto each subrouter
setupReviewRoutes(reviewRouter);
setupComposeRoutes(composeRouter);
setupMediaRoutes(mediaRouter);
setupMetricsRoutes(metricsRouter);
