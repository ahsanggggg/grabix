# This file is a compatibility shim.
# The actual code has moved to: backend/app/services/streaming_helpers.py
#
# All existing imports (from streaming_helpers import ...) keep working without any changes.
# Over time you can update imports to point to app.services.streaming_helpers directly.

from app.services.streaming_helpers import *  # noqa: F401, F403

# Private names are not re-exported by *, so we list them explicitly:
from app.services.streaming_helpers import (  # noqa: F401
    _extract_iframe_src,
    _fetch_json,
    _normalize_request_headers,
    _proxy_hls_resource_path,
    _rewrite_hls_playlist,
    _extract_hls_variants,
    _looks_like_playable_media_url,
    _fast_scan_html,
    _resolve_embed_target,
    _extract_stream_url_via_browser,
)
