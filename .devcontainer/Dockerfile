# Dev Container with Industrial Tooling
# Includes: Node 20, cosign, OPA, Playwright, Trivy

FROM mcr.microsoft.com/devcontainers/javascript-node:20-bullseye

# Install system dependencies
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get -y install --no-install-recommends \
       wget \
       curl \
       gnupg \
       jq \
       git \
       vim \
       bash-completion

# Install cosign
RUN COSIGN_VERSION="v2.2.0" && \
    curl -sLO "https://github.com/sigstore/cosign/releases/download/${COSIGN_VERSION}/cosign-linux-amd64" && \
    mv cosign-linux-amd64 /usr/local/bin/cosign && \
    chmod +x /usr/local/bin/cosign && \
    cosign version

# Install OPA
RUN OPA_VERSION="v0.58.0" && \
    curl -sLO "https://openpolicyagent.org/downloads/${OPA_VERSION}/opa_linux_amd64_static" && \
    mv opa_linux_amd64_static /usr/local/bin/opa && \
    chmod +x /usr/local/bin/opa && \
    opa version

# Install Trivy (vulnerability scanner)
RUN wget -qO - https://aquasecurity.github.io/trivy-repo/deb/public.key | apt-key add - && \
    echo "deb https://aquasecurity.github.io/trivy-repo/deb $(lsb_release -sc) main" | tee -a /etc/apt/sources.list.d/trivy.list && \
    apt-get update && \
    apt-get install -y trivy && \
    trivy --version

# Install Playwright system dependencies
RUN npx playwright install-deps chromium firefox webkit

# Install Helm
RUN curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# Install kubectl (for local k8s testing)
RUN curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl" && \
    install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl && \
    kubectl version --client

# Install k9s (Kubernetes CLI UI)
RUN K9S_VERSION="v0.28.2" && \
    curl -sLO "https://github.com/derailed/k9s/releases/download/${K9S_VERSION}/k9s_Linux_amd64.tar.gz" && \
    tar -xzf k9s_Linux_amd64.tar.gz && \
    mv k9s /usr/local/bin/ && \
    chmod +x /usr/local/bin/k9s && \
    rm k9s_Linux_amd64.tar.gz

# Set up bash completion
RUN echo "source /usr/share/bash-completion/bash_completion" >> /home/node/.bashrc && \
    kubectl completion bash >> /home/node/.bashrc && \
    helm completion bash >> /home/node/.bashrc

# Create workspace directory
WORKDIR /workspace

# Switch to node user
USER node

# Install global npm packages
RUN npm install -g \
    @cyclonedx/cyclonedx-npm \
    npm-check-updates \
    typescript

# Verify installations
RUN echo "✅ Installed tools:" && \
    node --version && \
    npm --version && \
    cosign version && \
    opa version && \
    trivy --version && \
    helm version --short && \
    kubectl version --client --short

CMD ["/bin/bash"]
