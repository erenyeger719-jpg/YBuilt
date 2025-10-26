// server/routes/deploy.docker.ts
import { Router } from "express";

const router = Router();

/**
 * POST /api/deploy/dockerize
 * Body: {
 *   kind: 'static' | 'node',   // default 'static'
 *   image: string,             // e.g. "ghcr.io/you/ybuilt-preview"
 *   tag?: string               // default 'latest'
 * }
 * Returns: { dockerfile, workflow, readme, build_cmd, push_cmd }
 */
router.post("/dockerize", (req, res) => {
  const kind = (req.body?.kind === "node" ? "node" : "static") as "static" | "node";
  const image = String(req.body?.image || "").trim();
  const tag = String(req.body?.tag || "latest").trim();

  if (!image) {
    return res.status(400).json({ ok: false, error: "image is required (e.g. ghcr.io/you/ybuilt-preview)" });
  }

  const dockerfileStatic = `
FROM nginx:1.27-alpine
# Copy build output or a static site into nginx web root
COPY . /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK CMD wget -qO- http://127.0.0.1/ || exit 1
`.trimStart();

  const dockerfileNode = `
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 3000
CMD ["npm","start"]
`.trimStart();

  const dockerfile = kind === "node" ? dockerfileNode : dockerfileStatic;

  const workflow = `
name: Build & Push Docker image

on:
  workflow_dispatch:
  push:
    paths:
      - "Dockerfile"
      - "**/*.html"
      - "**/*.js"
      - "**/*.css"
      - "package.json"
      - "package-lock.json"

jobs:
  docker:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4

      - name: Setup QEMU
        uses: docker/setup-qemu-action@v3

      - name: Setup Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to registry
        uses: docker/login-action@v3
        with:
          registry: \${{ secrets.REGISTRY || 'ghcr.io' }}
          username: \${{ secrets.REGISTRY_USER }}
          password: \${{ secrets.REGISTRY_TOKEN }}

      - name: Build and push
        uses: docker/build-push-action@v6
        with:
          context: .
          platforms: linux/amd64,linux/arm64
          push: true
          tags: ${image}:${tag}
          provenance: false
`.trimStart();

  const buildCmd = `docker build -t ${image}:${tag} .`;
  const pushCmd = `docker push ${image}:${tag}`;

  const readme = `
# Dockerize your preview

1) Save the Dockerfile content into \`Dockerfile\` at your project root.
2) (Optional) Save the suggested GitHub Actions workflow into \`.github/workflows/docker-publish.yml\`.
3) Local build & push:
   ${buildCmd}
   ${pushCmd}

Registry auth:
- **GHCR**: \`docker login ghcr.io -u <user> -p <PAT>\`
- **Docker Hub**: \`docker login -u <user> -p <token>\`
In GitHub Actions, set secrets: \`REGISTRY\` (ghcr.io or index.docker.io), \`REGISTRY_USER\`, \`REGISTRY_TOKEN\`.
`.trimStart();

  return res.json({
    ok: true,
    kind,
    image,
    tag,
    dockerfile,
    workflow,
    readme,
    build_cmd: buildCmd,
    push_cmd: pushCmd,
  });
});

export default router;
