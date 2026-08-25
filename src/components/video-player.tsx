import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { Loader2, AlertTriangle, Volume2, VolumeX, Maximize2 } from "lucide-react";
import type { Channel } from "@/lib/m3u";
import { Button } from "@/components/ui/button";

type Props = {
  channel: Channel | null;
};

export function VideoPlayer({ channel }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);

  const showControls = () => {
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setControlsVisible(false), 3000);
  };

  const toggleControls = () => {
    if (controlsVisible) {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      setControlsVisible(false);
    } else {
      showControls();
    }
  };

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !channel) return;

    setError(null);
    setLoading(true);
    showControls();

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const url = channel.url;
    const isHls = /\.m3u8(\?|$)/i.test(url);

    const seekToLiveEdge = () => {
      try {
        const seekable = video.seekable;
        if (seekable && seekable.length > 0) {
          const end = seekable.end(seekable.length - 1);
          if (isFinite(end) && end - video.currentTime > 2) {
            video.currentTime = Math.max(0, end - 0.5);
          }
        }
      } catch {
        /* ignore */
      }
    };

    const reloadNative = () => {
      try {
        const wasMuted = video.muted;
        // Cache-buster forces the browser to re-fetch the manifest
        const sep = url.includes("?") ? "&" : "?";
        video.src = `${url}${sep}_t=${Date.now()}`;
        video.muted = wasMuted;
        video.load();
      } catch {
        /* ignore */
      }
    };

    let lastTime = 0;
    let stalledSince = 0;
    const stallWatchdog = window.setInterval(() => {
      if (video.ended) {
        stalledSince = 0;
        return;
      }
      const isStalled =
        (!video.paused && video.currentTime === lastTime) ||
        (video.paused && document.visibilityState === "visible");

      if (isStalled) {
        stalledSince += 1;
        // First nudge at 3s: just try play() + seek to live
        if (stalledSince === 3) {
          seekToLiveEdge();
          video.play().catch(() => {});
        }
        // Hard recovery at 6s
        if (stalledSince >= 6) {
          stalledSince = 0;
          const hls = hlsRef.current;
          if (hls) {
            try {
              hls.recoverMediaError();
            } catch {
              hls.startLoad();
            }
          } else {
            reloadNative();
          }
          seekToLiveEdge();
          video.play().catch(() => {});
        }
      } else {
        stalledSince = 0;
        lastTime = video.currentTime;
      }
    }, 1000);

    const onPlaying = () => setLoading(false);
    const onWaiting = () => setLoading(true);
    const onError = () => {
      // Try recovery before giving up
      if (hlsRef.current) {
        try {
          hlsRef.current.recoverMediaError();
        } catch {
          setError("Каналът не може да бъде възпроизведен.");
        }
      } else {
        reloadNative();
        video.play().catch(() => {
          setError("Каналът не може да бъде възпроизведен.");
        });
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible" && video.paused) {
        seekToLiveEdge();
        video.play().catch(() => {});
      }
    };
    video.addEventListener("playing", onPlaying);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("error", onError);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onVisibility);

    if (isHls && Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
      hlsRef.current = hls;
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (!data.fatal) return;
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            // Try to resume from network blip
            hls.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            try {
              hls.recoverMediaError();
            } catch {
              setError("Потокът не е достъпен в момента.");
              setLoading(false);
            }
            break;
          default:
            setError("Потокът не е достъпен в момента.");
            setLoading(false);
        }
      });
    } else {
      video.src = url;
    }

    video.muted = false;
    setMuted(false);
    video.play().catch(() => {
      // Autoplay with audio blocked — fall back to muted autoplay
      video.muted = true;
      setMuted(true);
      video.play().catch(() => {
        /* still blocked */
      });
    });

    return () => {
      clearInterval(stallWatchdog);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("error", onError);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onVisibility);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [channel]);

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setMuted(videoRef.current.muted);
    showControls();
  };

  const goFullscreen = () => {
    const el = containerRef.current;
    const video = videoRef.current as (HTMLVideoElement & {
      webkitEnterFullscreen?: () => void;
    }) | null;
    const doc = document as Document & {
      webkitFullscreenElement?: Element;
      webkitExitFullscreen?: () => void;
    };

    if (document.fullscreenElement || doc.webkitFullscreenElement) {
      if (document.exitFullscreen) document.exitFullscreen();
      else if (doc.webkitExitFullscreen) doc.webkitExitFullscreen();
      showControls();
      return;
    }

    const containerEl = el as (HTMLDivElement & {
      webkitRequestFullscreen?: () => void;
    }) | null;

    if (containerEl?.requestFullscreen) {
      containerEl.requestFullscreen().catch(() => {
        video?.webkitEnterFullscreen?.();
      });
    } else if (containerEl?.webkitRequestFullscreen) {
      containerEl.webkitRequestFullscreen();
    } else if (video?.webkitEnterFullscreen) {
      // iOS Safari fallback — fullscreen on <video> element only
      video.webkitEnterFullscreen();
    }
    showControls();
  };

  return (
    <div
      ref={containerRef}
      className="group relative aspect-video w-full overflow-hidden rounded-xl border border-border bg-black shadow-[0_30px_80px_-20px_rgba(79,70,229,0.35)]"
      onMouseMove={showControls}
      onMouseLeave={() => setControlsVisible(false)}
      onTouchStart={showControls}
      onClick={toggleControls}
    >
      {channel ? (
        <video
          ref={videoRef}
          className="h-full w-full object-contain"
          autoPlay
          playsInline
          muted={muted}
          controls={false}
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-muted-foreground">
          <div className="brand-gradient flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-bold text-primary-foreground shadow-lg">
            BG
          </div>
          <p className="text-sm">Изберете канал, за да започнете гледането</p>
        </div>
      )}

      {channel && loading && !error && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40">
          <Loader2 className="h-8 w-8 animate-spin text-primary-foreground" />
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 px-6 text-center">
          <AlertTriangle className="h-8 w-8 text-destructive" />
          <p className="text-sm text-foreground">{error}</p>
          <p className="text-xs text-muted-foreground">Опитайте друг канал от списъка.</p>
        </div>
      )}

      {channel && (
        <>
          {/* Top overlay */}
          <div className={`pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 bg-gradient-to-b from-black/70 to-transparent p-3 transition-opacity duration-200 sm:p-4 ${controlsVisible ? "opacity-100" : "opacity-0"}`}>
            <div className="flex min-w-0 items-center gap-2.5">
              {channel.logo && (
                <img
                  src={channel.logo}
                  alt=""
                  className="h-9 w-9 rounded-md bg-white/10 object-contain p-1"
                  onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
                />
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-destructive-foreground">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                    На живо
                  </span>
                </div>
                <p className="truncate text-sm font-semibold text-white sm:text-base">{channel.name}</p>
                {channel.group && (
                  <p className="truncate text-xs text-white/70">{channel.group}</p>
                )}
              </div>
            </div>
          </div>

          {/* Bottom controls */}
          <div className={`pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-end gap-2 bg-gradient-to-t from-black/70 to-transparent p-3 transition-opacity duration-200 sm:p-4 [&>*]:pointer-events-auto ${controlsVisible ? "opacity-100" : "opacity-0"}`}>
            <Button size="icon" variant="secondary" className="h-9 w-9 rounded-full" onClick={(e) => { e.stopPropagation(); toggleMute(); }}>
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </Button>
            <Button size="icon" variant="secondary" className="h-9 w-9 rounded-full" onClick={(e) => { e.stopPropagation(); goFullscreen(); }}>
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
