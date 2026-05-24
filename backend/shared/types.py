from typing import TypedDict, Optional


class DownloadRecord(TypedDict):
    id: str
    url: str
    title: str
    file_path: str
    status: str
    progress: float
    eta: str
    speed: str
    error: str
    size: str


class DownloadStatus(TypedDict):
    id: str
    status: str
    progress: float
    speed: str
    eta: str


class ProviderResult(TypedDict):
    url: str
    quality: str
    provider: str


class StreamSource(TypedDict):
    url: str
    quality: str
    format: str
    subtitles: list


class HealthStatus(TypedDict):
    name: str
    status: str
    message: str


class RuntimeSnapshot(TypedDict):
    db_path: str
    download_dir: str
    logs_dir: str
    settings_path: str
    is_packaged: bool
