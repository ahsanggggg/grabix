"""
app/services/ytdlp_helpers.py

yt-dlp wrapper that handles YouTube bot detection automatically.

Root cause of most failures: outdated yt-dlp (Chrome 127+ App-Bound Encryption
broke cookie reading in older versions) + YouTube blocking old client signatures.

Strategy (automatic, zero user action):
  1. Try multiple YouTube player clients in order — each pretends to be a
     different YouTube app. YouTube bot-checks web browsers most aggressively;
     iOS / tv_embedded clients are usually not blocked.
  2. If all clients are blocked, try reading cookies from installed browsers
     (Chrome, Firefox, Edge). With an up-to-date yt-dlp this reads Chrome
     cookies correctly even on Chrome 127+ (App-Bound Encryption).
  3. If everything fails, return YOUTUBE_LOGIN_NEEDED so the UI can prompt
     the user to update yt-dlp (which fixes 90% of cases).
"""

from __future__ import annotations
import logging

logger = logging.getLogger("grabix.ytdlp_helpers")

# Try these YouTube player clients in order.
# ios and tv_embedded are less aggressively bot-checked than android/web.
_YT_PLAYER_CLIENTS = [
    ["ios"],
    ["android"],
    ["tv_embedded"],
    ["android_music"],
    ["mweb"],
    ["web_creator"],
]

_BROWSERS = ["chrome", "firefox", "edge", "brave", "chromium"]


def _is_youtube(url: str) -> bool:
    u = url.lower()
    return "youtube.com" in u or "youtu.be" in u


def _is_bot_error(exc: BaseException) -> bool:
    msg = str(exc).lower()
    return any(kw in msg for kw in (
        "sign in to confirm", "bot", "use --cookies",
        "cookies-from-browser", "authentication required",
    ))


def _try_extract(ydl_opts: dict, url: str, extra: dict | None = None) -> dict:
    """Single yt-dlp attempt. Raises on any error."""
    import yt_dlp
    opts = dict(ydl_opts)
    if extra:
        opts.update(extra)
    with yt_dlp.YoutubeDL(opts) as ydl:
        return ydl.extract_info(url, download=False)


def extract_info_with_cookies(ydl_opts: dict, url: str) -> dict:
    """
    Extract info from a URL, handling YouTube bot detection automatically.
    Tries multiple player clients then browser cookies — no user action needed.
    Raises RuntimeError("YOUTUBE_LOGIN_NEEDED") only as a last resort.
    """
    try:
        import yt_dlp  # noqa: F401
    except ImportError as exc:
        raise RuntimeError("yt-dlp is not installed") from exc

    if not _is_youtube(url):
        return _try_extract(ydl_opts, url)

    # ── Step 1: try each YouTube player client ────────────────────────────────
    for clients in _YT_PLAYER_CLIENTS:
        try:
            result = _try_extract(ydl_opts, url, extra={
                "extractor_args": {"youtube": {"player_client": clients}},
            })
            logger.debug("YouTube player_client=%s succeeded.", clients)
            return result
        except Exception as exc:
            if not _is_bot_error(exc):
                raise  # real error (bad URL, private video, etc.)
            logger.debug("player_client=%s blocked: %s", clients, exc)

    # ── Step 2: try browser cookie stores ────────────────────────────────────
    for browser in _BROWSERS:
        try:
            result = _try_extract(ydl_opts, url, extra={
                "cookiesfrombrowser": (browser,),
            })
            logger.debug("Browser %s cookies succeeded.", browser)
            return result
        except Exception as exc:
            logger.debug("Browser %s: %s", browser, exc)
            continue

    # ── Step 3: all failed — yt-dlp update usually fixes this ─────────────────
    raise RuntimeError("YOUTUBE_LOGIN_NEEDED")
