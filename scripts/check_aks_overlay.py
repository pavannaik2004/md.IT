"""Checks the rendered AKS overlay against the Phase 7 spec.

    kubectl kustomize k8s/overlays/aks > rendered.yaml
    python3 scripts/check_aks_overlay.py rendered.yaml

Exits 1 and names each failed check. Needs PyYAML.
"""

import sys

import yaml

HOST = "mdit.centralindia.cloudapp.azure.com"
APP_ROUTES = ("api", "api-signin", "api-upload", "web")

docs = [d for d in yaml.safe_load_all(open(sys.argv[1])) if d]
failures: list[str] = []


def check(name: str, ok: bool, got: object = None) -> None:
    print(("ok   " if ok else "FAIL ") + name + ("" if ok else f" (got {got!r})"))
    if not ok:
        failures.append(name)


def find(kind: str, name: str | None = None) -> list[dict]:
    return [d for d in docs if d["kind"] == kind and (name is None or d["metadata"]["name"] == name)]


def one(kind: str, name: str) -> dict:
    found = find(kind, name)
    return found[0] if found else {}


def env_from(doc: dict) -> list[str]:
    spec = doc.get("spec", {}).get("template", {}).get("spec", {})
    refs = []
    for c in spec.get("containers", []):
        for e in c.get("envFrom", []):
            refs.append((e.get("configMapRef") or e.get("secretRef") or {}).get("name"))
    return refs


check("no Namespace (azure.sh creates it; CI has no cluster rights)", not find("Namespace"), len(find("Namespace")))
check("no Secret in the overlay (azure.sh creates mdit-secrets)", not find("Secret"), len(find("Secret")))
check("no DEV_LOGIN anywhere (P-058)", "DEV_LOGIN" not in open(sys.argv[1]).read())

config = [d for d in find("ConfigMap") if d["metadata"]["name"].startswith("mdit-config")]
data = config[0]["data"] if config else {}
check("DB_SSL=true (P-114)", data.get("DB_SSL") == "true", data.get("DB_SSL"))
check("PUBLIC_BASE_URL is the site", data.get("PUBLIC_BASE_URL") == f"https://{HOST}", data.get("PUBLIC_BASE_URL"))
check("DB_HOST not hard-coded (comes from mdit-azure)", "DB_HOST" not in data, data.get("DB_HOST"))

for kind, name in (("Deployment", "backend"), ("Job", "mdit-migrate")):
    check(f"{name} reads ConfigMap mdit-azure", "mdit-azure" in env_from(one(kind, name)), env_from(one(kind, name)))

gw = one("Gateway", "mdit").get("spec", {})
listeners = {li["name"]: li for li in gw.get("listeners", [])}
check("Gateway http listener on 80", listeners.get("http", {}).get("port") == 80, listeners.get("http"))
https = listeners.get("https", {})
certs = [r.get("name") for r in https.get("tls", {}).get("certificateRefs", [])]
check("Gateway https listener on 443 with mdit-tls", (https.get("port"), https.get("protocol"), certs) == (443, "HTTPS", ["mdit-tls"]),
      (https.get("port"), https.get("protocol"), certs))
pref = gw.get("infrastructure", {}).get("parametersRef", {})
check("Gateway uses EnvoyProxy mdit-proxy", (pref.get("kind"), pref.get("name")) == ("EnvoyProxy", "mdit-proxy"), pref)

for route in APP_ROUTES:
    refs = one("HTTPRoute", route).get("spec", {}).get("parentRefs", [])
    check(f"route {route} binds to the https listener", [r.get("sectionName") for r in refs] == ["https"], refs)

redirect = one("HTTPRoute", "http-redirect").get("spec", {})
check("http-redirect binds to the http listener",
      [r.get("sectionName") for r in redirect.get("parentRefs", [])] == ["http"], redirect.get("parentRefs"))
filters = [f for rule in redirect.get("rules", []) for f in rule.get("filters", [])]
rr = filters[0].get("requestRedirect", {}) if filters else {}
check("http-redirect sends 301 to https", (rr.get("scheme"), rr.get("statusCode")) == ("https", 301), rr)

proxy = one("EnvoyProxy", "mdit-proxy").get("spec", {}).get("provider", {}).get("kubernetes", {})
annotations = proxy.get("envoyService", {}).get("annotations", {})
check("public IP gets DNS label mdit (P-120)",
      annotations.get("service.beta.kubernetes.io/azure-dns-label-name") == HOST.split(".")[0], annotations)
check("externalTrafficPolicy left at Envoy Gateway's Local default",
      "externalTrafficPolicy" not in proxy.get("envoyService", {}), proxy.get("envoyService"))
requests = proxy.get("envoyDeployment", {}).get("container", {}).get("resources", {}).get("requests", {})
check("proxy asks for 128Mi (fits one B2s node)", requests.get("memory") == "128Mi", requests)

for issuer in ("letsencrypt-staging", "letsencrypt-prod"):
    acme = one("Issuer", issuer).get("spec", {}).get("acme", {})
    solver = (acme.get("solvers") or [{}])[0].get("http01", {}).get("gatewayHTTPRoute", {})
    check(f"Issuer {issuer} solves HTTP-01 on the http listener",
          [r.get("sectionName") for r in solver.get("parentRefs", [])] == ["http"], solver)
    check(f"Issuer {issuer} has no e-mail", "email" not in acme, acme.get("email"))

sa = one("ServiceAccount", "default")
check("default ServiceAccount pulls with acr-pull",
      [s.get("name") for s in sa.get("imagePullSecrets", [])] == ["acr-pull"], sa.get("imagePullSecrets"))

if failures:
    print(f"{len(failures)} failed")
    sys.exit(1)
print("all passed")
