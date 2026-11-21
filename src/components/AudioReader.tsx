"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Segment = { id: string; text: string };

type Props = {
  segments: Segment[];
  chapterTitle: string;
  openSignal?: number;
};

type VoiceOption = { id: string; name: string };

const FALLBACK_VOICES: VoiceOption[] = [{ id: "baidu-female", name: "中文女声" }];

const PREF_KEY = "dr_tts_pref_v1";

// 手机浏览器（尤其微信内置）要求音频在用户手势内「解锁」，
// 否则后续异步 play() 会被静默拦截，表现为点了播放没声音。
let audioUnlocked = false;
function unlockAudio() {
  if (audioUnlocked) return;
  try {
    const silent = new Audio(
      "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=",
    );
    silent.volume = 0;
    silent.play().catch(() => undefined);
    audioUnlocked = true;
  } catch {
    // 忽略不支持的环境
  }
}

type MusicTrack = "off" | "rain" | "piano" | "local";

// 阅读器「听书」：云端语音（Azure）可用时用它，否则用浏览器内置语音。
// 注意：浏览器语音必须在点击的同一事件里调用 speak()，
// 否则安卓 Chrome 会静默拒绝播放（表现为「没有声音」）。
export default function AudioReader({ segments, chapterTitle, openSignal = 0 }: Props) {
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [idx, setIdx] = useState(0);
  const [voice, setVoice] = useState(FALLBACK_VOICES[0].id);
  const [voices, setVoices] = useState<VoiceOption[]>(FALLBACK_VOICES);
  const [rate, setRate] = useState(1);
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState<
    "unknown" | "azure" | "edge" | "baidu" | "none"
  >("unknown");
  const [notice, setNotice] = useState("");
  const [music, setMusic] = useState<MusicTrack>("rain");
  const [musicVolume, setMusicVolume] = useState(0.1);
  const [localTrack, setLocalTrack] = useState<{ url: string; name: string } | null>(
    null,
  );

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const musicRampRef = useRef<number | null>(null);
  const cacheRef = useRef<Map<string, string>>(new Map());
  const pendingRef = useRef<Set<string>>(new Set());
  const idxRef = useRef(0);
  const playingRef = useRef(false);
  const runRef = useRef(0);
  const highlightRef = useRef<HTMLElement | null>(null);

  // 顶部工具栏「听书」唤起：展开面板并滚到音频区
  useEffect(() => {
    if (openSignal > 0) {
      setOpen(true);
      document
        .getElementById("reader-audio")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [openSignal]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PREF_KEY);
      if (raw) {
        const pref = JSON.parse(raw);
        if (typeof pref.voice === "string") {
          setVoice(pref.voice);
        }
        if (typeof pref.rate === "number") setRate(pref.rate);
        if (pref.music === "off" || pref.music === "rain" || pref.music === "piano") {
          setMusic(pref.music);
        }
        if (typeof pref.musicVolume === "number") {
          setMusicVolume(Math.min(0.2, Math.max(0, pref.musicVolume)));
        }
      }
    } catch {
      // 忽略损坏的偏好
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        PREF_KEY,
        JSON.stringify({ voice, rate, music, musicVolume }),
      );
    } catch {
      // 忽略写入失败
    }
  }, [voice, rate, music, musicVolume]);

  // 探测服务端是否配置了云端语音
  useEffect(() => {
    let alive = true;
    fetch("/api/tts")
      .then((r) => r.json())
      .then((d) => {
        if (alive) {
          const p = d?.provider;
          setProvider(
            p === "azure" || p === "edge" || p === "baidu" ? p : "none",
          );
          if (Array.isArray(d?.voices) && d.voices.length > 0) {
            const opts: VoiceOption[] = d.voices.map(
              (v: { id: string; name: string }) => ({ id: v.id, name: v.name }),
            );
            setVoices(opts);
            setVoice((cur) =>
              opts.some((v) => v.id === cur) ? cur : opts[0].id,
            );
          }
        }
      })
      .catch(() => {
        if (alive) setProvider("none");
      });
    return () => {
      alive = false;
    };
  }, []);

  const cacheKey = (seg: Segment) => `${seg.id}|${voice}|${rate}`;

  const fetchAudio = useCallback(
    async (seg: Segment): Promise<string> => {
      const key = cacheKey(seg);
      const cached = cacheRef.current.get(key);
      if (cached) return cached;
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: seg.text, voice, rate }),
      });
      if (!res.ok) throw new Error("语音合成失败");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      cacheRef.current.set(key, url);
      return url;
    },
    [voice, rate],
  );

  const prefetch = useCallback(
    (i: number) => {
      const seg = segments[i];
      if (!seg || provider === "none") return;
      const key = cacheKey(seg);
      if (cacheRef.current.has(key) || pendingRef.current.has(key)) return;
      pendingRef.current.add(key);
      fetchAudio(seg)
        .catch(() => {
          // 预取失败静默处理
        })
        .finally(() => pendingRef.current.delete(key));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [segments, provider, fetchAudio, voice, rate],
  );

  const clearHighlight = () => {
    highlightRef.current?.classList.remove("reader-block-speaking");
    highlightRef.current = null;
  };

  const markHighlight = (seg?: Segment) => {
    clearHighlight();
    if (!seg) return;
    const el = document.getElementById(`para-${seg.id}`);
    if (!el) return;
    el.classList.add("reader-block-speaking");
    highlightRef.current = el;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  /** 音乐随朗读会话整体启停，不随分段中断 */
  const startMusic = useCallback(() => {
    if (typeof window === "undefined" || music === "off") return;
    const src =
      music === "local"
        ? localTrack?.url
        : `/audio/${music === "piano" ? "piano" : "rain"}-loop.mp3?v=5`;
    if (!src) return;

    let el = musicRef.current;
    if (!el || el.dataset.src !== src) {
      el?.pause();
      el = new Audio(src);
      el.loop = true;
      el.preload = "auto";
      el.dataset.src = src;
      el.volume = 0;
      musicRef.current = el;
    }
    el.play().catch(() => undefined);

    if (musicRampRef.current) window.clearInterval(musicRampRef.current);
    musicRampRef.current = window.setInterval(() => {
      const cur = musicRef.current;
      if (!cur) return;
      const diff = musicVolume - cur.volume;
      if (Math.abs(diff) < 0.005) {
        cur.volume = musicVolume;
        if (musicRampRef.current) {
          window.clearInterval(musicRampRef.current);
          musicRampRef.current = null;
        }
        return;
      }
      cur.volume = Math.max(0, Math.min(1, cur.volume + Math.sign(diff) * 0.01));
    }, 60);
  }, [music, musicVolume, localTrack]);

  const stopMusic = useCallback(() => {
    if (musicRampRef.current) {
      window.clearInterval(musicRampRef.current);
      musicRampRef.current = null;
    }
    const el = musicRef.current;
    if (!el || el.paused) return;
    const from = el.volume;
    let step = 0;
    const timer = window.setInterval(() => {
      step += 1;
      el.volume = Math.max(0, from * (1 - step / 12));
      if (step >= 12) {
        window.clearInterval(timer);
        el.pause();
        el.currentTime = 0;
      }
    }, 60);
  }, []);

  const stopAll = useCallback(() => {
    playingRef.current = false;
    runRef.current += 1;
    const audio = audioRef.current;
    if (audio) {
      audio.onended = null;
      audio.pause();
      audioRef.current = null;
    }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setPlaying(false);
    setLoading(false);
  }, []);

  const speakBrowser = useCallback(
    (i: number) => {
      const seg = segments[i];
      if (!seg) {
        stopAll();
        return;
      }
      const synth = window.speechSynthesis;
      if (!synth) {
        setNotice("当前浏览器不支持朗读");
        stopAll();
        return;
      }
      const utter = new SpeechSynthesisUtterance(seg.text);
      utter.lang = "zh-CN";
      utter.rate = rate;
      utter.volume = 1;
      utter.onend = () => {
        if (playingRef.current && idxRef.current === i) speakBrowser(i + 1);
      };
      utter.onerror = (e) => {
        if (e.error === "interrupted" || e.error === "canceled") return;
        setNotice("系统语音无法播放，请检查手机的文字转语音设置");
        stopAll();
      };
      idxRef.current = i;
      setIdx(i);
      playingRef.current = true;
      markHighlight(seg);
      synth.speak(utter);
      setPlaying(true);
      setLoading(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [segments, rate, stopAll],
  );

  const playAt = useCallback(
    (i: number) => {
      if (i < 0 || i >= segments.length) {
        stopAll();
        return;
      }
      const seg = segments[i];
      idxRef.current = i;
      setIdx(i);
      playingRef.current = true;
      markHighlight(seg);
      setPlaying(true);
      setNotice("");

      if (provider === "none") {
        speakBrowser(i);
        return;
      }

      const run = runRef.current;
      prefetch(i + 1);
      setLoading(true);
      fetchAudio(seg)
        .then((url) => {
          if (run !== runRef.current || idxRef.current !== i) return;
          const audio = new Audio(url);
          audioRef.current = audio;
          audio.onended = () => {
            if (playingRef.current && idxRef.current === i) playAt(i + 1);
          };
          return audio.play().then(() => setLoading(false));
        })
        .catch(() => {
          // 云端失败：切回系统语音，并继续当前段
          setProvider("none");
          setLoading(false);
          setNotice("云端语音不可用，已切换本地语音");
          if (run === runRef.current) speakBrowser(i);
        });
    },
    [provider, fetchAudio, prefetch, segments, speakBrowser, stopAll],
  );

  useEffect(() => {
    stopAll();
    setIdx(0);
    cacheRef.current.forEach((url) => URL.revokeObjectURL(url));
    cacheRef.current.clear();
  }, [chapterTitle, stopAll]);

  // 切换音色或语速时立即用新参数重读当前段，避免旧音色继续念下去
  const prevVoiceRef = useRef({ voice, rate });
  useEffect(() => {
    const prev = prevVoiceRef.current;
    if (prev.voice === voice && prev.rate === rate) return;
    prevVoiceRef.current = { voice, rate };
    if (!open) return;
    const wasPlaying = playingRef.current;
    stopAll();
    setPlaying(false);
    setLoading(false);
    if (wasPlaying) playAt(idxRef.current);
  }, [voice, rate, open, playAt, stopAll]);

  useEffect(() => () => stopAll(), [stopAll]);

  // 朗读进行中保持背景音乐，暂停或收起时淡出
  useEffect(() => {
    if (open && playing) startMusic();
    else stopMusic();
  }, [open, playing, startMusic, stopMusic]);

  useEffect(() => () => stopMusic(), [stopMusic]);

  const togglePlay = () => {
    if (playing) {
      playingRef.current = false;
      audioRef.current?.pause();
      window.speechSynthesis?.pause();
      setPlaying(false);
      return;
    }
    const audio = audioRef.current;
    if (audio && audio.paused && audio.currentTime > 0) {
      playingRef.current = true;
      audio.play();
      setPlaying(true);
      return;
    }
    if (window.speechSynthesis?.paused && provider === "none") {
      playingRef.current = true;
      window.speechSynthesis.resume();
      setPlaying(true);
      return;
    }
    playAt(idxRef.current);
  };

  const jump = (delta: number) => {
    const next = idxRef.current + delta;
    if (next < 0 || next >= segments.length) return;
    runRef.current += 1;
    audioRef.current?.pause();
    window.speechSynthesis?.cancel();
    playAt(next);
  };

  const close = () => {
    stopAll();
    clearHighlight();
    setOpen(false);
  };

  if (segments.length === 0) return null;

  return (
    <>
      <button
        type="button"
        className="btn-ghost btn-sm"
        onClick={() => {
          unlockAudio();
          setOpen(true);
        }}
      >
        听书
      </button>

      {open && (
        <div className="tts-panel">
          <div className="tts-head">
            <span className="kicker">LISTEN</span>
            <button type="button" className="tts-close" onClick={close}>
              收起
            </button>
          </div>

          <div className="tts-title">{chapterTitle}</div>
          <div className="tts-pos">
            第 {idx + 1} / {segments.length} 段
            {loading && <span className="tts-hint"> · 准备中…</span>}
            {provider === "none" && (
              <span className="tts-hint"> · 本地语音</span>
            )}
            {notice && <span className="tts-hint"> · {notice}</span>}
          </div>

          <div className="tts-controls">
            <button
              type="button"
              className="btn-line btn-sm"
              onClick={() => jump(-1)}
              disabled={idx === 0}
            >
              上一段
            </button>
            <button type="button" className="btn btn-sm" onClick={togglePlay}>
              {playing ? "暂停" : "播放"}
            </button>
            <button
              type="button"
              className="btn-line btn-sm"
              onClick={() => jump(1)}
              disabled={idx >= segments.length - 1}
            >
              下一段
            </button>
          </div>

          <div className="tts-fields">
            <label className="tts-field">
              <span>音色</span>
              <select
                value={voice}
                onChange={(e) => {
                  setVoice(e.target.value);
                  if (playingRef.current && provider !== "none") {
                    runRef.current += 1;
                    audioRef.current?.pause();
                    playAt(idxRef.current);
                  }
                }}
                disabled={provider === "none"}
              >
                {voices.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="tts-field">
              <span>语速 {rate.toFixed(1)}×</span>
              <input
                type="range"
                min={0.6}
                max={1.8}
                step={0.1}
                value={rate}
                onChange={(e) => setRate(Number(e.target.value))}
                onMouseUp={() => {
                  if (playingRef.current) playAt(idxRef.current);
                }}
                onTouchEnd={() => {
                  if (playingRef.current) playAt(idxRef.current);
                }}
              />
            </label>
          </div>

          <div className="tts-fields">
            <label className="tts-field">
              <span>背景音乐</span>
              <select
                value={music}
                onChange={(e) => {
                  const next = e.target.value as MusicTrack;
                  if (next === "local" && !localTrack) {
                    document.getElementById("tts-local-audio")?.click();
                    return;
                  }
                  setMusic(next);
                }}
              >
                <option value="off">关闭</option>
                <option value="rain">雨声 / 白噪</option>
                <option value="piano">极简钢琴</option>
                <option value="local">
                  {localTrack ? `本地：${localTrack.name}` : "本地音乐…"}
                </option>
              </select>
              <input
                id="tts-local-audio"
                type="file"
                accept="audio/*"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const url = URL.createObjectURL(file);
                  setLocalTrack({ url, name: file.name.slice(0, 12) });
                  setMusic("local");
                  e.target.value = "";
                }}
              />
            </label>

            <label className="tts-field">
              <span>音乐音量 {Math.round((musicVolume / 0.2) * 100)}%</span>
              <input
                type="range"
                min={0}
                max={0.2}
                step={0.01}
                value={musicVolume}
                onChange={(e) => setMusicVolume(Number(e.target.value))}
                disabled={music === "off"}
              />
            </label>
          </div>
        </div>
      )}
    </>
  );
}
