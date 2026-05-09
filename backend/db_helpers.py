# This file is a compatibility shim.
# The actual code has moved to: backend/app/services/db_helpers.py
#
# All existing imports (from db_helpers import ...) keep working without any changes.
# Over time you can update imports to point to app.services.db_helpers directly.

from app.services.db_helpers import *  # noqa: F401, F403

# Private names are not re-exported by *, so we list them explicitly:
from app.services.db_helpers import (  # noqa: F401
    _format_bytes,
    _format_bytes_int,
    _format_eta,
    _sanitize_download_engine,
    _guess_dl_type_from_path,
    _get_file_size,
    _strip_ansi,
    _make_connection,
    _close_pooled_connections,
)
