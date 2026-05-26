#!/bin/bash
set -euo pipefail
CONF=/var/lib/pgsql/data/postgresql.conf
HBA=/var/lib/pgsql/data/pg_hba.conf

python3 << 'PY'
from pathlib import Path
p = Path("/var/lib/pgsql/data/postgresql.conf")
lines = p.read_text().splitlines()
out = []
replaced = False
for line in lines:
    if line.startswith("listen_addresses"):
        if not replaced:
            out.append("listen_addresses = '*'")
            replaced = True
    else:
        out.append(line)
if not replaced:
    out.append("listen_addresses = '*'")
p.write_text("\n".join(out) + "\n")
PY

if ! grep -q "0.0.0.0/0" "$HBA"; then
  echo "host    all    all    0.0.0.0/0    scram-sha-256" >> "$HBA"
fi

systemctl restart postgresql
sleep 2
systemctl is-active postgresql
ss -tlnp | grep 5432 || true
grep -v '^#' "$HBA" | grep host || true
