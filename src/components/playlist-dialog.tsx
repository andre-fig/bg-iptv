import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const FIXED_PLAYLIST = "https://raw.githubusercontent.com/andre-fig/bg-iptv-script/main/playlist.m3u8";

export function PlaylistDialog() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(FIXED_PLAYLIST);
      } else {
        const ta = document.createElement("textarea");
        ta.value = FIXED_PLAYLIST;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      toast.success("Линкът към плейлистата е копиран");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Неуспешно копиране на линка");
    }
  };

  return (
    <Button size="sm" variant="secondary" className="gap-2" onClick={handleCopy}>
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      <span className="hidden sm:inline">{copied ? "Копирано" : "Копирай плейлиста"}</span>
    </Button>
  );
}
