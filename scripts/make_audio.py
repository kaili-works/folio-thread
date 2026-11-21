"""生成背景音（雨声 / 钢琴），输出到 background-music，再由 sync-audio 复制到 public/audio。

纯程序合成、无版权素材。钢琴为 Gymnopédie 风格原创小品：
3/4 慢板（约 66 BPM），左手低音 + 中音区和弦，右手稀疏长音旋律，约 3 分钟。
用法：python scripts/make_audio.py && node scripts/sync-audio.mjs
"""
import os

import lameenc
import numpy as np
from scipy.signal import fftconvolve

SR = 22050
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "background-music")


def fft_lowpass(x: np.ndarray, cutoff: float, order: int = 2) -> np.ndarray:
    spectrum = np.fft.rfft(x)
    freqs = np.fft.rfftfreq(len(x), 1.0 / SR)
    response = 1.0 / (1.0 + (freqs / cutoff) ** (2 * order))
    return np.fft.irfft(spectrum * response, len(x))


def fft_highpass(x: np.ndarray, cutoff: float, order: int = 2) -> np.ndarray:
    return x - fft_lowpass(x, cutoff, order)


def seamless(x: np.ndarray, fade: float = 0.6) -> np.ndarray:
    n = int(fade * SR)
    if n * 2 >= len(x):
        return x
    head = x[:n].copy()
    tail = x[-n:].copy()
    ramp = np.linspace(0.0, 1.0, n)
    x = x[:-n]
    x[:n] = head * ramp + tail * (1.0 - ramp)
    return x


def make_rain(seconds: int = 90) -> np.ndarray:
    rng = np.random.default_rng(7)
    n = seconds * SR
    base = rng.normal(0.0, 1.0, n)
    rain = fft_highpass(fft_lowpass(base, 5200.0), 420.0) * 0.30
    rain += fft_lowpass(rng.normal(0.0, 1.0, n), 220.0) * 0.55

    t = np.arange(n) / SR
    rain *= 0.85 + 0.15 * np.sin(2 * np.pi * t / 17.0)

    drops = np.zeros(n)
    for _ in range(int(seconds * 5)):
        start = rng.integers(0, n - 4000)
        length = rng.integers(600, 2600)
        env = np.exp(-np.linspace(0.0, 6.0, length))
        drops[start : start + length] += rng.normal(0.0, 1.0, length) * env * rng.uniform(0.05, 0.18)

    rain = seamless(rain + drops, 1.2)
    return rain / (np.max(np.abs(rain)) + 1e-9) * 0.55


NOTE = {
    "B1": 61.74, "D2": 73.42, "E2": 82.41, "F#2": 92.50, "G2": 98.00, "A2": 110.00, "B2": 123.47,
    "C#3": 138.59, "D3": 146.83, "E3": 164.81, "F#3": 185.00, "G3": 196.00, "A3": 220.00, "B3": 246.94,
    "C#4": 277.18, "D4": 293.66, "E4": 329.63, "F#4": 369.99, "G4": 392.00, "A4": 440.00, "B4": 493.88,
    "C#5": 554.37, "D5": 587.33, "E5": 659.25, "F#5": 739.99, "A5": 880.00,
}

# 每个和弦给出低音与中音区排列，模仿 Satie 的“低音 + 悬挂和弦”
CHORDS = {
    "Dmaj7": ("D2", ["D3", "F#3", "A3", "C#4"]),
    "Gmaj7": ("G2", ["G3", "B3", "D4", "F#4"]),
    "Bm7": ("B2", ["B3", "D4", "F#4", "A3"]),
    "Em7": ("E2", ["E3", "G3", "B3", "D4"]),
    "A7sus4": ("A2", ["A3", "D4", "E4", "G4"]),
    "F#m7": ("F#2", ["F#3", "A3", "C#4", "E4"]),
}

TEMPLATE_CHORDS = {
    "I": ["Dmaj7", "Gmaj7", "Dmaj7", "Gmaj7"],
    "A": ["Dmaj7", "Gmaj7", "Dmaj7", "Gmaj7"],
    "B": ["F#m7", "Bm7", "Em7", "A7sus4"],
    "C": ["Dmaj7", "Gmaj7", "Bm7", "F#m7"],
    "D": ["Em7", "A7sus4", "Dmaj7", "Dmaj7"],
}

# 旋律按 (小节序号, 起始拍, 时值拍, 音名) 写死，保证乐句可记忆而不是随机游走
PHRASES = {
    "A1": [
        (0, 0, 2.0, "A4"), (0, 2, 1.0, "F#4"),
        (1, 0, 1.5, "B4"), (1, 1.5, 1.5, "A4"),
        (2, 0, 2.0, "F#4"), (2, 2, 1.0, "E4"),
        (3, 0, 3.0, "D4"),
    ],
    "A2": [
        (0, 0, 1.5, "F#4"), (0, 1.5, 1.5, "A4"),
        (1, 0, 2.0, "B4"), (1, 2, 1.0, "D5"),
        (2, 0, 1.5, "C#5"), (2, 1.5, 1.5, "A4"),
        (3, 0, 2.0, "B4"), (3, 2, 1.0, "F#4"),
    ],
    "A3": [
        (0, 0, 2.0, "D5"), (0, 2, 1.0, "C#5"),
        (1, 0, 1.5, "B4"), (1, 1.5, 1.5, "D5"),
        (2, 0, 2.0, "A4"), (2, 2, 1.0, "F#4"),
        (3, 0, 3.0, "G4"),
    ],
    "A4": [
        (0, 0, 1.0, "F#4"), (0, 1, 1.0, "A4"), (0, 2, 1.0, "C#5"),
        (1, 0, 2.0, "B4"), (1, 2, 1.0, "A4"),
        (2, 0, 3.0, "F#4"),
    ],
    "B1": [
        (0, 0, 2.0, "C#5"), (0, 2, 1.0, "A4"),
        (1, 0, 2.0, "B4"), (1, 2, 1.0, "F#4"),
        (2, 0, 2.0, "G4"), (2, 2, 1.0, "B4"),
        (3, 0, 3.0, "A4"),
    ],
    "B2": [
        (0, 0, 1.5, "A4"), (0, 1.5, 1.5, "C#5"),
        (1, 0, 1.5, "D5"), (1, 1.5, 1.5, "B4"),
        (2, 0, 1.0, "E5"), (2, 1, 1.0, "D5"), (2, 2, 1.0, "B4"),
        (3, 0, 2.0, "A4"), (3, 2, 1.0, "G4"),
    ],
    "C1": [
        (0, 0, 2.0, "A4"), (0, 2, 1.0, "D5"),
        (1, 0, 2.0, "B4"), (1, 2, 1.0, "G4"),
        (2, 0, 2.0, "F#4"), (2, 2, 1.0, "A4"),
        (3, 0, 3.0, "C#5"),
    ],
    "C2": [
        (0, 0, 1.0, "D5"), (0, 1, 1.0, "C#5"), (0, 2, 1.0, "A4"),
        (1, 0, 3.0, "B4"),
        (2, 0, 2.0, "D5"), (2, 2, 1.0, "F#4"),
        (3, 0, 3.0, "E4"),
    ],
    "D1": [
        (0, 0, 2.0, "B4"), (0, 2, 1.0, "G4"),
        (1, 0, 2.0, "A4"), (1, 2, 1.0, "E4"),
        (2, 0, 2.0, "F#4"), (2, 2, 1.0, "A4"),
        (3, 0, 3.0, "D4"),
    ],
}

# 每次 (段落和弦, 旋律)；16 个四小节块，第 1 块是纯伴奏引子
SEQUENCE = [
    ("I", None),
    ("A", "A1"), ("A", "A2"), ("A", "A3"),
    ("B", "B1"), ("B", "B2"),
    ("C", "C1"), ("C", "C2"),
    ("A", "A1"), ("A", "A3"),
    ("B", "B1"), ("B", "B2"),
    ("C", "C1"), ("A", "A2"), ("A", "A3"),
    ("D", "D1"),
]


def piano_note(freq: float, dur: float, amp: float, rng: np.random.Generator) -> np.ndarray:
    """加性合成：低次泛音 + 轻微失谐双弦 + 锤击噪声，指数衰减。"""
    n = int(dur * SR)
    t = np.arange(n) / SR
    attack = 1.0 - np.exp(-t * 260.0)
    body = np.exp(-t * (0.55 + freq / 900.0))
    tail = np.exp(-t * (0.22 + freq / 2600.0)) * 0.25
    env = (body + tail) * attack

    tone = np.zeros(n)
    for k in range(1, 13):
        partial = freq * k * np.sqrt(1.0 + 0.00035 * k * k)
        if partial > SR / 2 - 200:
            break
        tone += np.sin(2 * np.pi * partial * t) * (1.0 / k**1.35) * np.exp(-t * (0.9 + 0.5 * k))

    # 第二根弦轻微失谐，避免电子琴的“单薄”感
    tone += 0.35 * np.sin(2 * np.pi * freq * 1.0007 * t + 0.4) * np.exp(-t * 1.1)
    hammer = rng.normal(0.0, 1.0, n) * np.exp(-t * 260.0) * 0.035
    return np.tanh((tone + hammer) * env * amp * 1.4)


def make_ir(seconds: float = 2.6) -> np.ndarray:
    """合成一段柔和厅堂混响脉冲响应（衰减噪声 + 几次早反射）。"""
    rng = np.random.default_rng(19)
    n = int(seconds * SR)
    t = np.arange(n) / SR
    ir = rng.normal(0.0, 1.0, n) * np.exp(-t * 2.2)
    ir = fft_lowpass(ir, 3600.0, 2)
    for delay, gain in ((0.019, 0.50), (0.031, 0.35), (0.047, 0.25), (0.071, 0.18)):
        ir[int(delay * SR)] += gain
    return ir / (np.max(np.abs(ir)) + 1e-9)


def make_piano() -> np.ndarray:
    rng = np.random.default_rng(2026)
    beat = 0.84  # ≈ 71 BPM
    bar_len = beat * 3
    total_bars = len(SEQUENCE) * 4
    loop_len = int(total_bars * bar_len * SR)
    buf = np.zeros(loop_len + SR * 8)

    def add(name: str, start: float, seconds: float, amp: float) -> None:
        i = int(start * SR)
        if i < 0 or i >= len(buf):
            return
        note = piano_note(NOTE[name], seconds, amp, rng)
        end = min(len(buf), i + len(note))
        buf[i:end] += note[: end - i]

    for block_index, (template, phrase) in enumerate(SEQUENCE):
        chords = TEMPLATE_CHORDS[template]
        if block_index == 0:
            dyn = 0.62
        elif block_index <= 6:
            dyn = 0.80 + 0.03 * block_index
        elif block_index <= 13:
            dyn = 1.0
        else:
            dyn = 0.86

        for bar_in_block, chord_name in enumerate(chords):
            bar = block_index * 4 + bar_in_block
            bar_start = bar * bar_len + rng.normal(0.0, 0.02)

            bass, voicing = CHORDS[chord_name]
            add(bass, bar_start, bar_len * 1.35, 0.34 * dyn)

            # 和弦落在第二拍，轻微滚奏；这是 Gymnopédie 式的核心律动
            for k, name in enumerate(voicing):
                add(name, bar_start + beat + 0.018 * k, bar_len * 1.15, 0.115 * dyn)

        if phrase is None:
            continue
        for bar_in_block, pos, length, name in PHRASES[phrase]:
            if rng.random() < 0.08:
                continue
            start = (block_index * 4 + bar_in_block) * bar_len + pos * beat + rng.normal(0.0, 0.012)
            amp = 0.30 * dyn * (0.92 + 0.16 * rng.random())
            add(name, start, length * beat * 1.25, amp)

    mix = buf[:loop_len]
    wet = fftconvolve(mix, make_ir())[:loop_len]
    mix = fft_highpass(mix * 0.74 + wet * 0.30, 32.0, 1)
    mix = seamless(mix, 2.8)
    return mix / (np.max(np.abs(mix)) + 1e-9) * 0.72


def write_mp3(samples: np.ndarray, path: str, bitrate: int = 88) -> None:
    pcm = np.clip(samples, -1.0, 1.0)
    pcm16 = (pcm * 32767).astype(np.int16)
    encoder = lameenc.Encoder()
    encoder.set_bit_rate(bitrate)
    encoder.set_in_sample_rate(SR)
    encoder.set_channels(1)
    encoder.set_quality(3)
    data = encoder.encode(pcm16.tobytes())
    data += encoder.flush()
    with open(path, "wb") as f:
        f.write(data)


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    for name, samples in (("rain", make_rain()), ("piano", make_piano())):
        path = os.path.join(OUT_DIR, f"{name}-loop.mp3")
        write_mp3(samples, path)
        print(name, round(len(samples) / SR), "s", os.path.getsize(path), "bytes")


if __name__ == "__main__":
    main()
