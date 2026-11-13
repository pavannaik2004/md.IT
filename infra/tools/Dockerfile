# One image for everything Phase 7 runs against Azure (P-121): Azure CLI, Terraform, kubectl.
# Built and run by scripts/lib/azure_tools.sh; nothing is installed on the host.
FROM mcr.microsoft.com/azure-cli:2.91.0

ARG TERRAFORM_VERSION=1.17.1
ARG TERRAFORM_SHA256=4638628058e71a55212b1c563712eac03b902128f40740f3dc8174df12135061
ARG KUBECTL_VERSION=v1.36.6
ARG KUBECTL_SHA256=29818b6729dc9262b692307470d0558d027725e738be5dd47c760261868a2634

# Checksums are pinned here, not fetched next to the download, so a swapped file fails the build.
RUN set -eu; \
    curl -fsSLo /tmp/tf.zip "https://releases.hashicorp.com/terraform/${TERRAFORM_VERSION}/terraform_${TERRAFORM_VERSION}_linux_amd64.zip"; \
    echo "${TERRAFORM_SHA256}  /tmp/tf.zip" | sha256sum -c -; \
    python3 -c "import zipfile; zipfile.ZipFile('/tmp/tf.zip').extract('terraform', '/usr/local/bin')"; \
    chmod +x /usr/local/bin/terraform; \
    rm /tmp/tf.zip; \
    curl -fsSLo /usr/local/bin/kubectl "https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/linux/amd64/kubectl"; \
    echo "${KUBECTL_SHA256}  /usr/local/bin/kubectl" | sha256sum -c -; \
    chmod +x /usr/local/bin/kubectl

# PyYAML for scripts/check_aks_overlay.py (the Azure CLI's own Python is separate).
RUN tdnf install -y python3-pyyaml && tdnf clean all

WORKDIR /work
