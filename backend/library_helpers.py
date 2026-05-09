# This file is a compatibility shim.
# The actual code has moved to: backend/app/services/library_helpers.py
#
# All existing imports (from library_helpers import ...) keep working without any changes.
# Over time you can update imports to point to app.services.library_helpers directly.

from app.services.library_helpers import *  # noqa: F401, F403

# Private names are not re-exported by *, so we list them explicitly:
from app.services.library_helpers import (  # noqa: F401
    _resolve_main_helpers,
    _is_internal_managed_file,
    _infer_download_category,
    _infer_library_display_layout,
    _build_library_index,
    _reconcile_library_state,
)
