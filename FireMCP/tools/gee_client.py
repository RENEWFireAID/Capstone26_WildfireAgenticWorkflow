"""Lazy Google Earth Engine initialization.

Earth Engine is never initialized at import time, so FireMCP starts normally on
machines without credentials. The first tool call that needs GEE triggers
initialization; if that fails, a GeeNotConfigured error carries a message that
is safe to show to the user.

Auth modes, in priority order:
  1. Service account (production) - set both EE_SERVICE_ACCOUNT and EE_KEY_FILE.
  2. Personal credentials (development) - run `earthengine authenticate` once,
     then set EE_PROJECT.
"""

import os
import threading

import ee


class GeeNotConfigured(RuntimeError):
    """Earth Engine credentials are missing or invalid."""


_initialized = False
_lock = threading.Lock()


def _initialize() -> None:
    service_account = os.getenv("EE_SERVICE_ACCOUNT")
    key_file = os.getenv("EE_KEY_FILE")
    project = os.getenv("EE_PROJECT")

    if service_account and key_file:
        if not os.path.isfile(key_file):
            raise GeeNotConfigured(
                f"EE_KEY_FILE points to {key_file}, which does not exist. "
                "Mount the service account key into the container and set "
                "EE_KEY_FILE to its path inside the container."
            )
        credentials = ee.ServiceAccountCredentials(service_account, key_file)
        if project:
            ee.Initialize(credentials, project=project)
        else:
            ee.Initialize(credentials)
        return

    if not project:
        raise GeeNotConfigured(
            "Earth Engine is not configured. For development, run "
            "`earthengine authenticate` on the host and set EE_PROJECT to your "
            "Google Cloud project id. For production, set EE_SERVICE_ACCOUNT and "
            "EE_KEY_FILE instead. See .env.example."
        )

    ee.Initialize(project=project)


def ensure_initialized() -> None:
    """Initialize Earth Engine once, raising GeeNotConfigured on failure."""
    global _initialized
    if _initialized:
        return
    with _lock:
        if _initialized:
            return
        try:
            _initialize()
        except GeeNotConfigured:
            raise
        except Exception as e:
            raise GeeNotConfigured(
                f"Earth Engine initialization failed: {e}. Check that EE_PROJECT "
                "is a project with the Earth Engine API enabled, and that "
                "`earthengine authenticate` credentials are readable "
                "(~/.config/earthengine/credentials)."
            ) from e
        _initialized = True
