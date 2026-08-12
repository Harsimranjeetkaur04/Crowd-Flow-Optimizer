"""Reset PostgreSQL 18 user password and create crowdflow_db database."""

import os
import subprocess
import psycopg2

CONF_PATH = "C:/Program Files/PostgreSQL/18/data/pg_hba.conf"


def reset_pg18_password(new_password: str = "postgrespassword") -> dict:
    if not os.path.exists(CONF_PATH):
        return {"status": "error", "message": f"Path {CONF_PATH} does not exist."}

    # 1. Backup original pg_hba.conf
    with open(CONF_PATH, "r", encoding="utf-8") as f:
        original_content = f.read()

    # 2. Modify pg_hba.conf to trust local connections
    trust_content = original_content.replace("scram-sha-256", "trust").replace("md5", "trust")
    with open(CONF_PATH, "w", encoding="utf-8") as f:
        f.write(trust_content)
    print("Updated PostgreSQL 18 pg_hba.conf to trust mode.")

    # 3. Restart PostgreSQL 18 service
    subprocess.run('powershell -Command "Restart-Service -Name postgresql-x64-18 -Force"', shell=True)

    # 4. Connect to PostgreSQL 18 on candidate ports
    pg18_port = None
    for port in [5434, 5432, 5433, 5435]:
        try:
            conn = psycopg2.connect(host="127.0.0.1", port=port, user="postgres", dbname="postgres")
            conn.autocommit = True
            cur = conn.cursor()
            cur.execute(f"ALTER USER postgres WITH PASSWORD '{new_password}';")
            print(f"Successfully reset PostgreSQL 18 postgres password on port {port}!")

            # Create crowdflow_db database if missing
            cur.execute("SELECT 1 FROM pg_database WHERE datname='crowdflow_db';")
            if not cur.fetchone():
                cur.execute("CREATE DATABASE crowdflow_db;")
                print(f"Created 'crowdflow_db' on PostgreSQL 18 (port {port}).")

            cur.close()
            conn.close()
            pg18_port = port
            break
        except Exception as exc:
            print(f"Port {port} check: {exc}")

    # 5. Restore pg_hba.conf and restart service
    with open(CONF_PATH, "w", encoding="utf-8") as f:
        f.write(original_content)
    subprocess.run('powershell -Command "Restart-Service -Name postgresql-x64-18 -Force"', shell=True)

    if pg18_port:
        return {"status": "success", "port": pg18_port, "password": new_password}
    return {"status": "failed", "message": "Could not connect to PostgreSQL 18."}


if __name__ == "__main__":
    res = reset_pg18_password()
    print("PostgreSQL 18 Reset Result:", res)
