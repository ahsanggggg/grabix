// grabix-ui/src/pages/useDownloaderQueue.ts
// Custom hook: queue state, SSE sync, startDownload, startBatch, and all queue actions.
// startDownload/startBatch accept all needed params explicitly — no stale closures.

import { useState, useRef, useEffect } from "react";
import { BACKEND_API, backendFetch } from "../lib/api";
import {
  QueueItem, VideoInfo, FileType, DownloadEngine,
  toQueueItem, uid, variantLabelForRequest, loadStoredQueue, storeQueueSnapshot,
} from "./downloader.types";

const API = BACKEND_API;

export interface StartDownloadParams {
  url:              string;
  info:             VideoInfo;
  fileType:         FileType;
  quality:          string;
  audioFormat:      string;
  subtitleLang:     string;
  thumbnailFormat:  string;
  trimStart:        number;
  trimEnd:          number;
  trimOpen:         boolean;
  useCpu:           boolean;
  downloadEngine:   DownloadEngine;
  onDownloadStarting?: () => void;
}

export function useDownloaderQueue() {
  const [queue, setQueue] = useState<QueueItem[]>(() => loadStoredQueue());
  const pollingRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());
  // FIX 6: track whether SSE is currently delivering updates. When healthy,
  // per-task polling is skipped — SSE already covers it every 250 ms.
  // Polling only activates as a fallback when SSE drops.
  const sseHealthyRef = useRef(false);

  // ── SSE sync ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    let active = true;
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const applyServerData = (data: any[]) => {
      if (!active) return;
      setQueue((prev) => {
        const previousById = new Map(prev.map((item) => [item.serverId || item.id, item]));
        const synced = data.map((srv) => toQueueItem(srv, previousById.get(srv.id)));
        const pendingLocal = prev.filter((item) => {
          if (item.serverId) return false;
          return !synced.some((s) =>
            s.url === item.url && s.fileType === item.fileType && s.variantLabel === item.variantLabel
          );
        });
        return [...pendingLocal, ...synced];
      });
    };

    const connectSSE = () => {
      if (!active) return;

      if (es) {
        try { es.close(); } catch { /* ignore */ }
        es = null;
      }

      es = new EventSource(`${API}/downloads/stream?_t=${Date.now()}`);

      es.onmessage = (e) => {
        // FIX 6: mark SSE as healthy on first real message so polling backs off.
        sseHealthyRef.current = true;
        try { applyServerData(JSON.parse(e.data) as any[]); } catch { /* ignore malformed frames */ }
      };

      es.onerror = () => {
        // FIX 6: SSE dropped — enable fallback polling for active tasks.
        sseHealthyRef.current = false;
        try { es?.close(); } catch { /* ignore */ }
        es = null;

        if (!active) return;

        void backendFetch(`${API}/downloads?_t=${Date.now()}`, undefined, { sensitive: true })
          .then((r) => r.ok ? r.json() : null)
          .then((data) => { if (data && active) applyServerData(data as any[]); })
          .catch(() => undefined);

        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          if (active) connectSSE();
        }, 3000);
      };
    };

    connectSSE();

    return () => {
      active = false;
      sseHealthyRef.current = false;
      try { es?.close(); } catch { /* ignore */ }
      if (reconnectTimer) clearTimeout(reconnectTimer);
      pollingRef.current.forEach((t) => clearInterval(t));
      pollingRef.current.clear();
    };
  }, []);

  // Persist queue to localStorage
  useEffect(() => { storeQueueSnapshot(queue); }, [queue]);

  // ── Per-task polling helper ───────────────────────────────────────────────────
  // FIX 6: polling is the SSE fallback, not the primary channel. Only starts
  // a polling interval when SSE is unhealthy. When SSE recovers, new _pollTask
  // calls will no-op and the SSE stream takes over.
  function _pollTask(serverTaskId: string) {
    if (sseHealthyRef.current) return; // SSE is covering it — no need to poll

    const MAX_CONSECUTIVE_ERRORS = 8;
    let consecutiveErrors = 0;

    const interval = setInterval(async () => {
      // Stop polling if SSE has since recovered.
      if (sseHealthyRef.current) {
        clearInterval(interval);
        pollingRef.current.delete(serverTaskId);
        return;
      }
      try {
        const pr  = await backendFetch(`${API}/download-status/${serverTaskId}?_t=${Date.now()}`, undefined, { sensitive: true });
        if (!pr.ok) throw new Error(`status ${pr.status}`);
        const pd  = await pr.json();
        consecutiveErrors = 0;

        const isDone = ["done", "failed", "canceled", "error"].includes(pd.status);
        setQueue((prev) =>
          prev.map((q) =>
            (q.serverId || q.id) !== serverTaskId ? q : {
              ...q,
              status:         pd.status,
              percent:        pd.percent          ?? q.percent,
              speed:          pd.speed            ?? "",
              eta:            pd.eta              ?? "",
              downloaded:     pd.downloaded       ?? "",
              total:          pd.total            ?? "",
              size:           pd.size             ?? "",
              filePath:       pd.file_path        ?? "",
              partialFilePath: pd.partial_file_path ?? q.partialFilePath,
              error:          pd.error            ?? "",
              canPause:       pd.can_pause        ?? q.canPause,
              bytesDownloaded: pd.bytes_downloaded ?? q.bytesDownloaded,
              bytesTotal:     pd.bytes_total      ?? q.bytesTotal,
              progressMode:   pd.progress_mode    ?? q.progressMode,
              stageLabel:     pd.stage_label      ?? q.stageLabel,
              variantLabel:   pd.variant_label    ?? q.variantLabel,
              aria2Segments:           isDone ? [] : (Array.isArray(pd.aria2_segments)            ? pd.aria2_segments            : q.aria2Segments),
              aria2ConnectionSegments: isDone ? [] : (Array.isArray(pd.aria2_connection_segments) ? pd.aria2_connection_segments : q.aria2ConnectionSegments),
            }
          )
        );
        if (isDone) { clearInterval(interval); pollingRef.current.delete(serverTaskId); }
      } catch {
        consecutiveErrors++;
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          clearInterval(interval);
          pollingRef.current.delete(serverTaskId);
        }
      }
    }, 1000);
    pollingRef.current.set(serverTaskId, interval);
  }

  // ── startDownload ─────────────────────────────────────────────────────────────
  const startDownload = async (p: StartDownloadParams) => {
    const effectiveEngine: DownloadEngine =
      p.fileType === "thumbnail" || p.fileType === "subtitle" ? "standard" : p.downloadEngine;
    const variantLabel = variantLabelForRequest(p.fileType, p.quality, p.audioFormat, p.subtitleLang, p.thumbnailFormat);
    const taskId = uid();

    const newItem: QueueItem = {
      id: taskId, serverId: "", url: p.url, title: p.info.title, thumbnail: p.info.thumbnail,
      format: variantLabel, fileType: p.fileType, status: "queued", percent: 0, speed: "", eta: "",
      downloaded: "", total: "", size: "", filePath: "", partialFilePath: "", error: "",
      canPause: false, recoverable: false, retryCount: 0, failureCode: "",
      downloadEngine: effectiveEngine, requestedEngine: effectiveEngine, engineNote: "",
      bytesDownloaded: 0, bytesTotal: 0, progressMode: "activity", stageLabel: "Queued",
      variantLabel, aria2Segments: [], aria2ConnectionSegments: [],
    };
    setQueue((prev) => [newItem, ...prev]);

    try {
      const trimEnabled = p.trimOpen && p.trimEnd - p.trimStart < p.info.duration;
      const forceHls    = p.url.toLowerCase().includes(".m3u8");
      p.onDownloadStarting?.();
      const qs = `url=${encodeURIComponent(p.url)}&title=${encodeURIComponent(p.info.title)}&thumbnail=${encodeURIComponent(p.info.thumbnail)}&dl_type=${p.fileType}&quality=${p.quality}&audio_format=${p.audioFormat}&subtitle_lang=${p.subtitleLang}&thumbnail_format=${p.thumbnailFormat}&trim_start=${p.trimStart}&trim_end=${p.trimEnd}&trim_enabled=${trimEnabled}&use_cpu=${p.useCpu}&download_engine=${encodeURIComponent(effectiveEngine)}${forceHls ? "&force_hls=true" : ""}`;
      const res = await backendFetch(`${API}/download?${qs}`, undefined, { sensitive: true });
      if (!res.ok) {
        let msg = `Download failed (${res.status})`;
        try { const d = await res.json(); msg = d.detail || d.error || msg; } catch {}
        throw new Error(msg);
      }
      const data = await res.json();
      const serverTaskId = data.task_id ?? taskId;
      setQueue((prev) => prev.map((q) => q.id === taskId ? { ...q, id: serverTaskId, serverId: serverTaskId } : q));
      _pollTask(serverTaskId);
    } catch (err) {
      setQueue((prev) => prev.map((q) =>
        q.id === taskId ? { ...q, status: "error", error: err instanceof Error ? err.message : "Download failed. Please try again." } : q
      ));
    }
  };

  // ── startBatch ────────────────────────────────────────────────────────────────
  const startBatch = async (batchUrls: string, p: Omit<StartDownloadParams, "url" | "info">) => {
    const urls = batchUrls.split("\n").map((u) => u.trim()).filter(Boolean);
    for (const bUrl of urls) {
      const effectiveEngine: DownloadEngine =
        p.fileType === "thumbnail" || p.fileType === "subtitle" ? "standard" : p.downloadEngine;
      const variantLabel = variantLabelForRequest(p.fileType, p.quality, p.audioFormat, p.subtitleLang, p.thumbnailFormat);
      const taskId = uid();
      const newItem: QueueItem = {
        id: taskId, serverId: "", url: bUrl,
        title: bUrl.length > 60 ? bUrl.slice(0, 57) + "…" : bUrl,
        thumbnail: "", format: variantLabel, fileType: p.fileType, status: "queued",
        percent: 0, speed: "", eta: "", downloaded: "", total: "", size: "",
        filePath: "", partialFilePath: "", error: "", canPause: false, recoverable: false,
        retryCount: 0, failureCode: "", downloadEngine: effectiveEngine,
        requestedEngine: effectiveEngine, engineNote: "", bytesDownloaded: 0, bytesTotal: 0,
        progressMode: "activity", stageLabel: "Queued", variantLabel, aria2Segments: [], aria2ConnectionSegments: [],
      };
      setQueue((prev) => [newItem, ...prev]);
      try {
        const forceHls = bUrl.toLowerCase().includes(".m3u8");
        p.onDownloadStarting?.();
        // FIX 10: batch has no VideoInfo, so we can't compute the real trimEnabled
        // check (trimOpen && trimEnd - trimStart < duration). Sending p.trimOpen
        // raw was silently wrong — trim would fire on every batch URL regardless
        // of whether the trim range made sense for that media's actual duration.
        // Safest fix: always disable trim in batch mode. Users who need trimmed
        // downloads should queue them individually via startDownload.
        const qs = `url=${encodeURIComponent(bUrl)}&dl_type=${p.fileType}&quality=${p.quality}&audio_format=${p.audioFormat}&subtitle_lang=${p.subtitleLang}&thumbnail_format=${p.thumbnailFormat}&trim_start=${p.trimStart}&trim_end=${p.trimEnd}&trim_enabled=false&use_cpu=${p.useCpu}&download_engine=${encodeURIComponent(effectiveEngine)}${forceHls ? "&force_hls=true" : ""}`;
        const res = await backendFetch(`${API}/download?${qs}`, undefined, { sensitive: true });
        if (!res.ok) throw new Error(`Download request failed with ${res.status}`);
        const data = await res.json();
        const serverTaskId = data.task_id ?? taskId;
        setQueue((prev) => prev.map((q) => q.id === taskId ? { ...q, id: serverTaskId, serverId: serverTaskId } : q));
        _pollTask(serverTaskId);
      } catch (err) {
        setQueue((prev) => prev.map((q) =>
          q.id === taskId ? { ...q, status: "error", error: err instanceof Error ? err.message : "Download failed. Please try again." } : q
        ));
      }
    }
  };

  // ── Queue actions ─────────────────────────────────────────────────────────────
  const removeFromQueue = async (item: QueueItem) => {
    const key = item.serverId || item.id;
    const t = pollingRef.current.get(key);
    if (t) { clearInterval(t); pollingRef.current.delete(key); }
    if (item.serverId) {
      try { await backendFetch(`${API}/downloads/${item.serverId}`, { method: "DELETE" }, { sensitive: true }); } catch {}
    }
    setQueue((prev) => prev.filter((q) => q.id !== item.id));
  };

  const clearAllQueue = async () => {
    const items = [...queue];
    pollingRef.current.forEach((t) => clearInterval(t));
    pollingRef.current.clear();
    await Promise.allSettled(
      items.filter((i) => i.serverId)
        .map((i) => backendFetch(`${API}/downloads/${i.serverId}`, { method: "DELETE" }, { sensitive: true }))
    );
    setQueue([]);
  };

  const doAction = async (item: QueueItem, action: string) => {
    if (!item.serverId) return;
    setQueue((prev) => prev.map((e) => e.id !== item.id ? e : {
      ...e,
      status: action === "pause"  ? "paused"      :
              action === "resume" ? "downloading"  :
              action === "cancel" ? "canceling"    : e.status,
    }));
    try {
      const res = await backendFetch(`${API}/downloads/${item.serverId}/action?action=${action}`, { method: "POST" }, { sensitive: true });
      if (!res.ok) throw new Error(`Action failed with ${res.status}`);
      // FIX Bug 4: when the user manually retries a failed task, the old
      // polling interval was cleared when the task reached "failed". If SSE
      // is down at this moment the retried task gets no status updates.
      // Restart polling so the fallback channel covers the new attempt.
      if (action === "retry") _pollTask(item.serverId);
    } catch {
      setQueue((prev) => prev.map((e) => e.id === item.id ? item : e));
    }
  };

  const doReveal = async (item: QueueItem) => {
    if (!item.filePath) return;
    try { await backendFetch(`${API}/open-download-folder?path=${encodeURIComponent(item.filePath)}`, { method: "POST" }, { sensitive: true }); } catch {}
  };

  return { queue, startDownload, startBatch, removeFromQueue, clearAllQueue, doAction, doReveal };
}
