"""Checks a Terraform plan (`terraform show -json plan`) against the Phase 7 spec.

Run in the tools image: python3 infra/tests/check_plan.py plan.json
Exits 1 and names each failed check.
"""

import json
import sys

failures: list[str] = []


def check(name: str, ok: bool, got: object = None) -> None:
    print(("ok   " if ok else "FAIL ") + name + ("" if ok else f" (got {got!r})"))
    if not ok:
        failures.append(name)


def first(changes: list[dict], rtype: str) -> dict:
    found = [c["change"]["after"] for c in changes if c["type"] == rtype]
    return found[0] if found else {}


plan = json.load(open(sys.argv[1]))
changes = plan.get("resource_changes", [])
types = [c["type"] for c in changes]

check("no role assignments (P-116)", "azurerm_role_assignment" not in types, types.count("azurerm_role_assignment"))
check("only creates", all(c["change"]["actions"] in (["create"], ["no-op"], ["read"]) for c in changes),
      sorted({",".join(c["change"]["actions"]) for c in changes}))

rgs = {c["change"]["after"].get("resource_group_name") for c in changes
       if c["change"]["after"] and "resource_group_name" in c["change"]["after"]}
check("everything in mdit-rg", rgs <= {"mdit-rg"}, rgs)
rg = first(changes, "azurerm_resource_group")
check("resource group mdit-rg in centralindia", (rg.get("name"), rg.get("location")) == ("mdit-rg", "centralindia"),
      (rg.get("name"), rg.get("location")))

acr = first(changes, "azurerm_container_registry")
check("ACR Basic with admin user", (acr.get("sku"), acr.get("admin_enabled")) == ("Basic", True),
      (acr.get("sku"), acr.get("admin_enabled")))

aks = first(changes, "azurerm_kubernetes_cluster")
pool = (aks.get("default_node_pool") or [{}])[0]
check("AKS Free tier", aks.get("sku_tier") == "Free", aks.get("sku_tier"))
check("AKS 1.36", aks.get("kubernetes_version") == "1.36", aks.get("kubernetes_version"))
check("one Standard_B2s node", (pool.get("vm_size"), pool.get("node_count")) == ("Standard_B2s", 1),
      (pool.get("vm_size"), pool.get("node_count")))
check("30 GB managed OS disk", (pool.get("os_disk_size_gb"), pool.get("os_disk_type")) == (30, "Managed"),
      (pool.get("os_disk_size_gb"), pool.get("os_disk_type")))
check("no monitoring add-on", not aks.get("oms_agent"), aks.get("oms_agent"))
check("node resource group MC_mdit-rg_*", str(aks.get("node_resource_group", "MC_mdit-rg_")).startswith("MC_mdit-rg_"),
      aks.get("node_resource_group"))

mysql = first(changes, "azurerm_mysql_flexible_server")
check("MySQL B_Standard_B1ms", mysql.get("sku_name") == "B_Standard_B1ms", mysql.get("sku_name"))
check("MySQL admin login mdit", mysql.get("administrator_login") == "mdit", mysql.get("administrator_login"))
storage = (mysql.get("storage") or [{}])[0]
check("MySQL 20 GB", storage.get("size_gb") == 20, storage.get("size_gb"))
check("MySQL no HA", not mysql.get("high_availability"), mysql.get("high_availability"))
db = first(changes, "azurerm_mysql_flexible_database")
check("database mdit utf8mb4", (db.get("name"), db.get("charset")) == ("mdit", "utf8mb4"), (db.get("name"), db.get("charset")))
check("one firewall rule", types.count("azurerm_mysql_flexible_server_firewall_rule") == 1,
      types.count("azurerm_mysql_flexible_server_firewall_rule"))

sa = first(changes, "azurerm_storage_account")
check("blob storage Standard LRS",
      (sa.get("account_tier"), sa.get("account_replication_type")) == ("Standard", "LRS"),
      (sa.get("account_tier"), sa.get("account_replication_type")))
check("storage TLS 1.2", sa.get("min_tls_version") == "TLS1_2", sa.get("min_tls_version"))

if failures:
    print(f"{len(failures)} failed")
    sys.exit(1)
print("all passed")
