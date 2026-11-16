"""
Earth Engine authentication and initialization utility.
Supports Google Cloud project initialization and service account fallback.
"""

import os
import ee
try:
    from .config import GEE_PROJECT
except (ImportError, ValueError):
    from config import GEE_PROJECT


def init_ee(project: str = GEE_PROJECT) -> bool:
    """
    Initialize the Earth Engine Python API.
    
    Tries:
    1. Service account credentials (if EE_SERVICE_ACCOUNT and EE_PRIVATE_KEY env vars exist).
    2. Local OAuth credentials tied to the specified GCP project.
    3. Interactive ee.Authenticate() if credentials are missing or expired.
    
    Returns True if initialized successfully, raises RuntimeError on failure.
    """
    # 1. Service Account (for deployed server / Hugging Face Spaces)
    if "EE_SERVICE_ACCOUNT" in os.environ and "EE_PRIVATE_KEY" in os.environ:
        try:
            private_key = os.environ["EE_PRIVATE_KEY"].replace("\\n", "\n")
            creds = ee.ServiceAccountCredentials(
                os.environ["EE_SERVICE_ACCOUNT"],
                key_data=private_key
            )
            ee.Initialize(credentials=creds, project=project)
            print(f"[auth] Earth Engine initialized via Service Account for project: {project}")
            return True
        except Exception as err:
            print(f"[auth] Service account init failed ({err}), falling back to local credentials...")

    # 2. Local OAuth credentials with specified project
    try:
        ee.Initialize(project=project)
        print(f"[auth] Earth Engine initialized successfully with project: {project}")
        return True
    except Exception as err:
        print(f"[auth] Direct ee.Initialize failed: {err}. Triggering ee.Authenticate()...")

    # 3. Interactive fallback
    try:
        ee.Authenticate()
        ee.Initialize(project=project)
        print(f"[auth] Earth Engine authenticated and initialized with project: {project}")
        return True
    except Exception as final_err:
        raise RuntimeError(
            f"Failed to authenticate/initialize Earth Engine: {final_err}\n"
            f"Please verify project '{project}' has Earth Engine API enabled in Google Cloud Console."
        )
