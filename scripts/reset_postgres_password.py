"""Automated script to reset local PostgreSQL postgres user password on Windows."""

import os
import glob
import subprocess
import psycopg2


def reset_postgres_password(new_password: str = "postgrespassword") -> dict:
    conf_paths = glob.glob("C:/Program Files/PostgreSQL/*/data/pg_hba.conf") + glob.glob("C:/ProgramData/PostgreSQL/*/data/pg_hba.conf")
    if not conf_paths:
        return {"status": "error", "message": "No pg_hba.conf found."}

    backups = {}
    # 1. Modify pg_hba.conf to trust local connections temporarily
    for path in conf_paths:
        try:
            with open(path, "r", encoding="utf-8") as f:
                content = f.read()
            backups[path] = content
            modified = content.replace("scram-sha-256", "trust").replace("md5", "trust")
            with open(path, "w", encoding="utf-8") as f:
                f.write(modified)
            print(f"Updated {path} to trust mode.")
        except Exception as e:
            print(f"Could not update {path}: {e}")

    # 2. Reload / Restart PostgreSQL Service
    for ver in ["16", "17", "18"]:
        subprocess.run(f'powershell -Command "Restart-Service -Name postgresql-x64-{ver} -ErrorAction SilentlyContinue"', shell=True)

    # 3. Connect & Reset Password
    reset_success = False
    for port in [5432, 5433, 5434]:
        try:
            conn = psycopg2.connect(host="127.0.0.1", port=port, user="postgres", dbname="postgres")
            conn.autocommit = True
            cur = conn.cursor()
            cur.execute(f"ALTER USER postgres WITH PASSWORD '{new_password}';")
            print(f"Successfully reset postgres user password to '{new_password}' on port {port}!")
            
            # Create crowdflow_db database if it doesn't exist
            cur.execute("SELECT 1 FROM pg_database WHERE datname='crowdflow_db';")
            if not cur.fetchone():
                cur.execute("CREATE DATABASE crowdflow_db;")
                print("Created database 'crowdflow_db'.")

            cur.close()
            conn.close()
            reset_success = True
            break
        except Exception as e:
            print(f"Port {port} connect attempt: {e}")

    # 4. Restore original pg_hba.conf files
    for path, content in backups.items():
        try:
            with open(path, "w", encoding="utf-8") as f:
                f.write(content)
            print(f"Restored {path}.")
        except Exception as e:
            print(f"Could not restore {path}: {e}")

    # 5. Restart services again
    for ver in ["16", "17", "18"]:
        subprocess.run(f'powershell -Command "Restart-Service -Name postgresql-x64-{ver} -ErrorAction SilentlyContinue"', shell=True)

    return {"status": "success" if reset_success else "failed", "new_password": new_password}


if __name__ == "__main__":
    res = reset_postgres_password()
    print("Password reset result:", res)
