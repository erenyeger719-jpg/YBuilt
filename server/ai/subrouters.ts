// server/ai/subrouters.ts
import { Router } from "express";

import * as Review from "./router.review.ts";
import * as Compose from "./router.compose.ts";
import * as Media from "./router.media.ts";
import * as Metrics from "./router.metrics.ts";

// pick common export names; fall back to an empty Router to keep boot green
const pick = (m: any) =>
  m?.default || m?.router || m?.routes || m?.app || m?.defaultRouter;

export const reviewRouter  = (pick(Review)  as any) || Router();
export const composeRouter = (pick(Compose) as any) || Router();
export const mediaRouter   = (pick(Media)   as any) || Router();
export const metricsRouter = (pick(Metrics) as any) || Router();
