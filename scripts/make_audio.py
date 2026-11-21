"""生成背景音（雨声 / 钢琴），输出到 public/audio。

纯程序合成、无版权素材；钢琴约 4 分钟，用四段不同和声与旋律变奏避免重复感。
用法：python scripts/make_audio.py
"""
import os

import lameenc
import numpy as np

SR = 22050
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "audio")


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


PITCH = {
    "F2": 87.31, "G2": 98.00, "A2": 110.00, "C3": 130.81, "D3": 146.83, "E3": 164.81,
    "F3": 174.61, "G3": 196.00, "A3": 220.00, "B3": 246.94, "C4": 261.63, "D4": 293.66,
    "E4": 329.63, "F4": 349.23, "G4": 392.00, "A4": 440.00, "B4": 493.88, "C5": 523.25,
    "D5": 587.33, "E5": 659.25, "G5": 783.99, "A5": 880.00,
}
SCALE = ["A3", "B3", "C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5", "D5", "E5", "G5", "A5"]


def piano_note(freq: float, dur: float, amp: float, rng: np.random.Generator) -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n) / SR
    decay = 1.5 + freq / 900.0
    env = np.exp(-t * decay) * (1.0 - np.exp(-t * 420.0))
    tone = np.zeros(n)
    for k, gain in ((1.0, 1.0), (2.005, 0.44), (3.01, 0.21), (4.03, 0.11), (5.08, 0.055), (6.15, 0.025)):
        tone += np.sin(2 * np.pi * freq * k * t + rng.uniform(0, 6.28)) * gain * np.exp(-t * decay * (k - 0.6))
    hammer = rng.normal(0.0, 1.0, n) * np.exp(-t * 300.0) * 0.05
    return (tone + hammer) * env * amp


# 四段和声：Am - F - C - G，以及 F - G - Am - Em
PROGRESSIONS = [
    [("A2", ["A3", "C4", "E4"]), ("F2", ["F3", "A3", "C4"]), ("C3", ["C4", "E4", "G4"]), ("G2", ["G3", "B3", "D4"])],
    [("F2", ["F3", "A3", "C4"]), ("G2", ["G3", "B3", "D4"]), ("A2", ["A3", "C4", "E4"]), ("E3", ["E3", "G3", "B3"])],
    [("A2", ["A3", "C4", "E4"]), ("E3", ["E3", "G3", "B3"]), ("F2", ["F3", "A3", "C4"]), ("G2", ["G3", "B3", "D4"])],
    [("C3", ["C4", "E4", "G4"]), ("G2", ["G3", "B3", "D4"]), ("A2", ["A3", "C4", "E4"]), ("F2", ["F3", "A3", "C4"])],
]

RHYTHMS = [
    [(0, 1.0), (1, 1.0), (2, 2.0)],
    [(0, 1.5), (1.5, 0.5), (2, 2.0)],
    [(0, 0.5), (0.5, 0.5), (1, 1.0), (2, 2.0)],
    [(0, 2.0), (2, 2.0)],
    [(0, 1.0), (1, 0.5), (1.5, 0.5), (2, 1.5)],
    [(0, 0.75), (0.75, 0.75), (1.5, 0.5), (2.5, 1.5)],
]


def make_piano(seconds: int = 240) -> np.ndarray:
    rng = np.random.default_rng(2024)
    beat = 0.62
    bar_beats = 4
    bar_len = beat * bar_beats
    n = seconds * SR
    buf = np.zeros(n + SR * 6)

    def add(name: str, start: float, dur: float, amp: float) -> None:
        i = int(start * SR)
        if i < 0 or i >= len(buf):
            return
        note = piano_note(PITCH[name], dur, amp, rng)
        end = min(len(buf), i + len(note))
        buf[i:end] += note[: end - i]

    total_bars = int(seconds / bar_len)
    section_len = max(1, total_bars // 4)
    degree = SCALE.index("A4")

    for bar in range(total_bars):
        section = min(3, bar // section_len)
        progression = PROGRESSIONS[section]
        root, chord = progression[bar % len(progression)]
        bar_start = bar * bar_len

        # 低音：每小节一次，末段加八度
        add(root, bar_start, bar_len * 1.6, 0.30)
        if section >= 2 and bar % 2 == 0:
            add(root.replace("2", "3").replace("E3", "E3"), bar_start, bar_len * 1.2, 0.16)

        # 分解和弦：段落不同密度，避免机械重复
        if section != 1:
            step = 0.5 if section == 3 else 1.0
            k = 0.0
            while k < bar_beats:
                name = chord[int(k / step) % len(chord)]
                add(name, bar_start + k * beat, 2.0, 0.09 + 0.02 * rng.random())
                k += step

        # 旋律：四小节一句，句末留长音形成呼吸
        if bar % 4 == 3:
            continue
        rhythm = RHYTHMS[(bar + section) % len(RHYTHMS)]
        for pos, length in rhythm:
            if rng.random() < 0.12:
                continue
            move = int(rng.integers(-2, 3))
            degree = max(0, min(len(SCALE) - 2, degree + move))
            name = SCALE[degree]
            amp = (0.30 if pos == 0 else 0.22) * (0.9 + 0.2 * rng.random())
            add(name, bar_start + pos * beat, 3.4, amp)

        # 第二段与第四段加一条高音对位，音色更厚
        if section in (1, 3) and bar % 2 == 0:
            add(SCALE[min(len(SCALE) - 1, degree + 3)], bar_start + beat, 2.6, 0.10)

    buf = buf[:n]

    wet = np.zeros_like(buf)
    for delay_ms, gain in ((113, 0.30), (197, 0.20), (281, 0.14), (419, 0.09), (563, 0.05)):
        d = int(delay_ms / 1000 * SR)
        wet[d:] += buf[:-d] * gain
    buf = fft_lowpass(buf + wet, 5200.0, 1)

    buf = seamless(buf, 2.0)
    return buf / (np.max(np.abs(buf)) + 1e-9) * 0.62


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
