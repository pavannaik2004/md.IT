#!/bin/sh
# md.IT on Azure, built only around internship reviews (Phase 7, P-119). See infra/README.md.
#
#   scripts/azure.sh login        sign in to Azure (device code; kept in Docker volume mdit-azure)
#   scripts/azure.sh up           build everything and deploy this commit (~25-30 min the first time)
#   scripts/azure.sh smoke        check the deployed site
#   scripts/azure.sh status       what exists, and whether the site answers
#   scripts/azure.sh down [--yes] destroy everything billed (Terraform state stays)
set -eu
cd "$(dirname "$0")/.."
. scripts/lib/azure_tools.sh

ENVOY_GATEWAY_VERSION=v1.9.3
CERT_MANAGER_VERSION=v1.21.3
RG=mdit-rg
AKS=mdit-aks
NS=mdit
LOCATION=centralindia
CI_SECRETS="KUBECONFIG_B64 ACR_USERNAME ACR_PASSWORD"

kc() { tools kubectl "$@"; }
tfout() { tools terraform -chdir=infra/terraform output -raw "$1" | tr -d '\r'; }
repo() { gh repo view --json nameWithOwner -q .nameWithOwner; }
# code <curl option or ""> <url>: the HTTP status ("000" when nothing answers).
code() { curl -s --max-time 10 ${1:+"$1"} -o /dev/null -w '%{http_code}' "$2" || true; }

# terraform <command> with the backend; on failure, show the end of its log and stop.
tf_run() {
  mkdir -p infra/.kube
  tools terraform -chdir=infra/terraform init -input=false -no-color \
    -backend-config=storage_account_name="$TFSTATE_ACCOUNT" > infra/.kube/terraform.log 2>&1 ||
    { tail -20 infra/.kube/terraform.log >&2; die "terraform init failed"; }
  tools terraform -chdir=infra/terraform "$@" -input=false -no-color -auto-approve > infra/.kube/terraform.log 2>&1 ||
    { tail -30 infra/.kube/terraform.log >&2; die "terraform $1 failed (above)"; }
  grep -E '^(Apply|Destroy) complete' infra/.kube/terraform.log || true
}

# Tracked changes anywhere, or untracked files where the images are built from: the images
# would not match the commit they're tagged with.
check_clean_tree() {
  if [ -n "$(git status --porcelain --untracked-files=no)" ] ||
    [ -n "$(git status --porcelain -- backend frontend)" ]; then
    die "uncommitted changes: commit them first, so the images match the commit they're tagged with"
  fi
  if [ -z "$(git branch -r --contains HEAD 2>/dev/null)" ]; then
    echo "warning: this commit isn't on GitHub yet; push it so the image tag can be traced" >&2
  fi
}

check_label() {
  if [ "$(tools az group exists -n "$RG" | tr -d '\r')" = true ]; then return 0; fi
  label=$(site_label)
  free=$(tools az rest --method get --url \
    "https://management.azure.com/subscriptions/$SUBSCRIPTION_ID/providers/Microsoft.Network/locations/$LOCATION/CheckDnsNameAvailability?domainNameLabel=$label&api-version=2024-05-01" \
    --query available -o tsv | tr -d '\r')
  [ "$free" = true ] ||
    die "the address $(site_host) is taken: pick another label in k8s/overlays/aks (PUBLIC_BASE_URL and envoyproxy.yaml) and update the OAuth callbacks"
}

check_github() {
  gh auth status >/dev/null 2>&1 || die "gh isn't signed in: run gh auth login"
  gh api "repos/$(repo)/environments/prod" >/dev/null 2>&1 ||
    die "GitHub environment 'prod' is missing: see infra/README.md (first-time setup)"
}

install_addons() {
  say "Installing Envoy Gateway $ENVOY_GATEWAY_VERSION and cert-manager $CERT_MANAGER_VERSION"
  kc apply --server-side --force-conflicts \
    -f "https://github.com/envoyproxy/gateway/releases/download/$ENVOY_GATEWAY_VERSION/install.yaml" >/dev/null
  kc -n envoy-gateway-system wait --for=condition=Available deployment/envoy-gateway --timeout=300s >/dev/null
  # Smaller than the defaults, to fit one B2s node (Phase 6 note).
  kc -n envoy-gateway-system set resources deployment/envoy-gateway --requests=cpu=50m,memory=128Mi >/dev/null
  kc apply -f k8s/cluster/ >/dev/null

  kc apply -f "https://github.com/cert-manager/cert-manager/releases/download/$CERT_MANAGER_VERSION/cert-manager.yaml" >/dev/null
  # The HTTP-01 solver answers through the Gateway API, which cert-manager only watches on request.
  if ! kc -n cert-manager get deployment cert-manager -o jsonpath='{.spec.template.spec.containers[0].args}' |
    grep -q enable-gateway-api; then
    kc -n cert-manager patch deployment cert-manager --type=json \
      -p '[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--enable-gateway-api"}]' >/dev/null
  fi
  for d in cert-manager cert-manager-cainjector cert-manager-webhook; do
    kc -n cert-manager rollout status "deployment/$d" --timeout=300s >/dev/null
  done
}

# Values from Terraform and infra/azure.env, written straight into the cluster (never Git).
write_app_config() {
  say "Writing cluster config and secrets"
  kc create namespace "$NS" --dry-run=client -o yaml | kc apply -f - >/dev/null
  kc -n "$NS" create configmap mdit-azure --from-literal=DB_HOST="$(tfout mysql_fqdn)" \
    --dry-run=client -o yaml | kc apply -f - >/dev/null

  before=$(kc -n "$NS" get secret mdit-secrets -o jsonpath='{.data}' 2>/dev/null || true)
  session=$(kc -n "$NS" get secret mdit-secrets -o jsonpath='{.data.SESSION_SECRET}' 2>/dev/null | base64 -d || true)
  [ -n "$session" ] || session=$(head -c 48 /dev/urandom | base64 | tr -d '/+=\n' | cut -c1-48)
  env_file=infra/.kube/secrets.env
  umask 077
  {
    echo "DB_PASSWORD=$(tfout db_password)"
    echo "BLOB_CONNECTION_STRING=$(tfout blob_connection_string)"
    echo "SESSION_SECRET=$session"
    for key in GITHUB_CLIENT_ID GITHUB_CLIENT_SECRET GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET; do
      eval "value=\${$key:-}"
      # shellcheck disable=SC2154
      [ -z "$value" ] || echo "$key=$value"
    done
  } > "$env_file"
  kc -n "$NS" create secret generic mdit-secrets --from-env-file="$env_file" \
    --dry-run=client -o yaml | kc apply -f - >/dev/null
  rm -f "$env_file"
  after=$(kc -n "$NS" get secret mdit-secrets -o jsonpath='{.data}')
  # The Secret has a fixed name, so pods don't notice a change on their own.
  if [ -n "$before" ] && [ "$before" != "$after" ] && kc -n "$NS" get deployment backend >/dev/null 2>&1; then
    echo "mdit-secrets changed: restarting the backend"
    kc -n "$NS" rollout restart deployment/backend >/dev/null
  fi

  printf '%s' "$(tfout acr_password)" > infra/.kube/acr.pw
  kc -n "$NS" create secret docker-registry acr-pull --docker-server="$(tfout acr_login_server)" \
    --docker-username="$(tfout acr_username)" --docker-password="$(cat infra/.kube/acr.pw)" \
    --dry-run=client -o yaml | kc apply -f - >/dev/null
  rm -f infra/.kube/acr.pw
}

# A ServiceAccount that can change only namespace mdit, for deploy.yml (P-116).
write_ci_access() {
  say "Giving GitHub Actions deploy access to namespace $NS"
  kc apply -f - >/dev/null <<EOF
apiVersion: v1
kind: ServiceAccount
metadata: {name: mdit-deployer, namespace: $NS}
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata: {name: mdit-deployer, namespace: $NS}
rules:
  - apiGroups: [""]
    resources: [configmaps, services, serviceaccounts]
    verbs: [get, list, watch, create, update, patch, delete]
  - apiGroups: [""]
    resources: [pods, pods/log]
    verbs: [get, list, watch]
  - apiGroups: [apps]
    resources: [deployments]
    verbs: [get, list, watch, create, update, patch, delete]
  - apiGroups: [batch]
    resources: [jobs]
    verbs: [get, list, watch, create, update, patch, delete]
  - apiGroups: [gateway.networking.k8s.io]
    resources: [gateways, httproutes]
    verbs: [get, list, watch, create, update, patch, delete]
  - apiGroups: [gateway.envoyproxy.io]
    resources: [backendtrafficpolicies, envoyproxies]
    verbs: [get, list, watch, create, update, patch, delete]
  - apiGroups: [cert-manager.io]
    resources: [issuers]
    verbs: [get, list, watch, create, update, patch, delete]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata: {name: mdit-deployer, namespace: $NS}
roleRef: {apiGroup: rbac.authorization.k8s.io, kind: Role, name: mdit-deployer}
subjects: [{kind: ServiceAccount, name: mdit-deployer, namespace: $NS}]
---
apiVersion: v1
kind: Secret
type: kubernetes.io/service-account-token
metadata:
  name: mdit-deployer-token
  namespace: $NS
  annotations: {kubernetes.io/service-account.name: mdit-deployer}
EOF
  i=0
  until token=$(kc -n "$NS" get secret mdit-deployer-token -o jsonpath='{.data.token}' | base64 -d) && [ -n "$token" ]; do
    i=$((i + 1)); [ $i -lt 30 ] || die "the deployer token wasn't issued"; sleep 2
  done
  server=$(kc config view --raw --minify -o jsonpath='{.clusters[0].cluster.server}')
  ca=$(kc config view --raw --minify -o jsonpath='{.clusters[0].cluster.certificate-authority-data}')
  umask 077
  cat > infra/.kube/ci-config <<EOF
apiVersion: v1
kind: Config
clusters: [{name: aks, cluster: {server: "$server", certificate-authority-data: "$ca"}}]
users: [{name: mdit-deployer, user: {token: "$token"}}]
contexts: [{name: deploy, context: {cluster: aks, user: mdit-deployer, namespace: $NS}}]
current-context: deploy
EOF
  r=$(repo)
  base64 -w0 infra/.kube/ci-config | gh secret set KUBECONFIG_B64 --env prod --repo "$r"
  tfout acr_username | gh secret set ACR_USERNAME --env prod --repo "$r"
  tfout acr_password | gh secret set ACR_PASSWORD --env prod --repo "$r"
  gh variable set ACR_LOGIN_SERVER --repo "$r" --body "$(tfout acr_login_server)"
  gh variable set MDIT_CLUSTER --repo "$r" --body up
}

deploy_this_commit() {
  acr=$(tfout acr_login_server)
  sha=$(git rev-parse HEAD)
  say "Building and pushing images for $sha"
  tfout acr_password | docker login "$acr" -u "$(tfout acr_username)" --password-stdin >/dev/null
  # One at a time: building both at once crashed Docker Desktop's WSL engine (Phase 6).
  for app in backend frontend; do
    docker build -q -t "$acr/mdit-$app:$sha" "$app" >/dev/null
    docker push -q "$acr/mdit-$app:$sha" >/dev/null
  done
  tools sh scripts/k8s_deploy.sh k8s/overlays/aks "$acr" "$sha"
}

request_certificate() {
  say "Requesting the $ACME_ISSUER certificate for $(site_host)"
  kc apply -f - >/dev/null <<EOF
apiVersion: cert-manager.io/v1
kind: Certificate
metadata: {name: mdit-tls, namespace: $NS}
spec:
  secretName: mdit-tls
  dnsNames: ["$(site_host)"]
  issuerRef: {kind: Issuer, name: letsencrypt-$ACME_ISSUER}
EOF
  kc -n "$NS" wait certificate/mdit-tls --for=condition=Ready --timeout=600s >/dev/null ||
    { kc -n "$NS" describe certificate mdit-tls | tail -15 >&2; die "the certificate wasn't issued (above)"; }
}

up() {
  started=$(date +%s)
  load_config
  [ -n "${TFSTATE_ACCOUNT:-}" ] || die "TFSTATE_ACCOUNT is empty: run infra/bootstrap.sh first"
  check_clean_tree
  preflight
  check_github
  check_label

  say "Terraform apply (AKS and MySQL take most of the time)"
  tf_run apply

  tools az aks get-credentials -g "$RG" -n "$AKS" --admin --file infra/.kube/config --overwrite-existing >/dev/null
  install_addons
  write_app_config
  write_ci_access
  deploy_this_commit
  request_certificate

  insecure=
  [ "$ACME_ISSUER" = prod ] || insecure=-k
  say "Waiting for $(site_url)"
  i=0
  until [ "$(code "$insecure" "$(site_url)/api/health/ready")" = 200 ]; do
    i=$((i + 1)); [ $i -lt 60 ] || die "$(site_url) isn't answering after 5 minutes (scripts/azure.sh status)"; sleep 5
  done
  say "md.IT is running at $(site_url) ($(( ($(date +%s) - started) / 60 )) min)"
  [ "$ACME_ISSUER" = prod ] || echo "(staging certificate: browsers will warn; set ACME_ISSUER=prod for a review)"
}

down() {
  load_config
  if [ "${1:-}" != --yes ]; then
    printf 'This destroys md.IT on Azure (database and blobs included). Type mdit to go on: '
    read -r answer || answer=
    [ "$answer" = mdit ] || die "cancelled"
  fi
  preflight
  r=$(repo)
  gh variable set MDIT_CLUSTER --repo "$r" --body down
  for s in $CI_SECRETS; do gh secret delete "$s" --env prod --repo "$r" >/dev/null 2>&1 || true; done

  say "Terraform destroy"
  tf_run destroy
  rm -rf infra/.kube

  left=$(tools az group list --query "[?starts_with(name, 'mdit-') || starts_with(name, 'MC_mdit-')].name" -o tsv |
    tr -d '\r' | grep -vx mdit-tfstate || true)
  if [ -n "$left" ]; then
    printf 'still in the subscription:\n%s\n' "$left" >&2
    die "something survived the destroy: delete it in the portal or run down again"
  fi
  say "Nothing of md.IT is left except the Terraform state (mdit-tfstate)"
}

status() {
  load_config
  preflight
  if [ "$(tools az group exists -n "$RG" | tr -d '\r')" != true ]; then
    echo "not deployed (scripts/azure.sh up builds it)"
    return 0
  fi
  echo "AKS: $(tools az aks show -g "$RG" -n "$AKS" --query powerState.code -o tsv 2>/dev/null | tr -d '\r')"
  echo "site: $(site_url)"
  echo "readiness: $(code -k "$(site_url)/api/health/ready")"
}

smoke() {
  load_config
  host=$(site_host)
  insecure=
  [ "$ACME_ISSUER" = prod ] || insecure=-k
  MDIT_BASE_URL=$(site_url) MDIT_CURL_OPTS=$insecure sh scripts/k8s_local.sh smoke
  redirect=$(curl -s --max-time 10 -o /dev/null -w '%{http_code} %{redirect_url}' "http://$host/projects" || true)
  if [ "$redirect" = "301 https://$host/projects" ]; then echo "ok    http redirects to https"; else die "http → https: got '$redirect'"; fi
  if [ "$ACME_ISSUER" = prod ]; then
    [ "$(code "" "$(site_url)/")" = 200 ] || die "the certificate isn't trusted"
    echo "ok    trusted certificate"
  else
    echo "skip  trusted certificate (staging issuer)"
  fi
}

case "${1:-}" in
  login) ensure_tools_image; tools az login --use-device-code --output none ;;
  up) up ;;
  down) down "${2:-}" ;;
  status) status ;;
  smoke) smoke ;;
  *) echo "usage: $0 login | up | smoke | status | down [--yes]" >&2; exit 2 ;;
esac
