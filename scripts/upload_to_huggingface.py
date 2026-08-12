"""Script to push trained model artifact and synthetic dataset to Hugging Face Hub."""

from __future__ import annotations

import os
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env")
load_dotenv(ROOT_DIR / "backend" / ".env")

MODEL_PATH = ROOT_DIR / "backend" / "app" / "ai" / "models" / "congestion_model.joblib"
DATASET_PATH = ROOT_DIR / "data" / "simulation_dataset.csv"


def upload_to_huggingface(
    repo_id: str | None = None,
    dataset_repo_id: str | None = None,
    token: str | None = None,
) -> dict:
    """Upload trained model joblib file and CSV dataset to Hugging Face Hub."""
    repo_id = repo_id or os.getenv("HF_MODEL_ID", "crowdflow-ai/congestion-risk-classifier")
    username = repo_id.split("/")[0] if "/" in repo_id else "crowdflow-ai"
    dataset_repo_id = dataset_repo_id or f"{username}/crowd-simulation-dataset"
    token = token or os.getenv("HF_TOKEN")
    if not token or token.strip() in {"", "hf_your_token_here"}:
        return {
            "status": "skipped",
            "reason": "Please paste your real Hugging Face token in your .env file (replace HF_TOKEN=hf_your_token_here on line 8 of .env). Get token at https://huggingface.co/settings/tokens",
            "model_path": str(MODEL_PATH),
            "dataset_path": str(DATASET_PATH),
        }

    try:
        from huggingface_hub import HfApi

        api = HfApi(token=token)

        # 1. Upload Model
        if MODEL_PATH.exists():
            api.create_repo(repo_id=repo_id, repo_type="model", exist_ok=True)
            api.upload_file(
                path_or_fileobj=str(MODEL_PATH),
                path_in_repo="congestion_model.joblib",
                repo_id=repo_id,
                repo_type="model",
            )
            print(f"Uploaded model to Hugging Face: https://huggingface.co/{repo_id}")

        # 2. Upload Dataset
        if DATASET_PATH.exists():
            api.create_repo(repo_id=dataset_repo_id, repo_type="dataset", exist_ok=True)
            api.upload_file(
                path_or_fileobj=str(DATASET_PATH),
                path_in_repo="simulation_dataset.csv",
                repo_id=dataset_repo_id,
                repo_type="dataset",
            )
            print(f"Uploaded dataset to Hugging Face: https://huggingface.co/datasets/{dataset_repo_id}")

        return {
            "status": "success",
            "model_url": f"https://huggingface.co/{repo_id}",
            "dataset_url": f"https://huggingface.co/datasets/{dataset_repo_id}",
        }
    except Exception as exc:
        return {"status": "error", "reason": str(exc)}


if __name__ == "__main__":
    res = upload_to_huggingface()
    print("Hugging Face upload status:", res)
