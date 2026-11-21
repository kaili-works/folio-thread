import https from "node:https";
import { execFile, spawn, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** 探测成功的 Python 解释器，避免每次重复尝试 */
let edgePython: string | null = null;

/** 常驻 edge-tts 工作进程，省去每次分段朗读启动 Python 的开销 */
let worker: ChildProcess | null = null;
let workerSeq = 0;
const workerPending = new Map<
  number,
  { resolve: () => void; reject: (err: Error) => void }
>();

function pythonBin(): string {
  return process.env.EDGE_TTS_PYTHON || "python";
}

function ensureWorker(): ChildProcess {
  if (worker && !worker.killed) return worker;
  const proc = spawn(
    pythonBin(),
    ["-u", path.join(process.cwd(), "scripts", "tts_worker.py")],
    { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] },
  );
  if (proc.stdout) {
    const lines = createInterface({ input: proc.stdout });
    lines.on("line", (line) => {
      try {
        const msg = JSON.parse(line) as { id: number; ok: boolean; error?: string };
        const task = workerPending.get(msg.id);
        if (!task) return;
        workerPending.delete(msg.id);
        if (msg.ok) task.resolve();
        else task.reject(new Error(msg.error || "edge-tts 合成失败"));
      } catch {
        // 忽略非 JSON 输出
      }
    });
  }
  proc.on("exit", () => {
    worker = null;
    for (const task of workerPending.values()) {
      task.reject(new Error("edge-tts 进程已退出"));
    }
    workerPending.clear();
  });
  // spawn 失败（如 EDGE_TTS_PYTHON 指向不存在的路径）只会触发 error，不会触发 exit
  proc.on("error", (err) => {
    worker = null;
    for (const task of workerPending.values()) {
      task.reject(err);
    }
    workerPending.clear();
  });
  worker = proc;
  return proc;
}

async function workerSpeech(
  text: string,
  voice: string,
  rate: number,
): Promise<Buffer> {
  const out = path.join(
    tmpdir(),
    `folio-tts-${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`,
  );
  const proc = ensureWorker();
  const id = ++workerSeq;
  const percent = Math.round((rate - 1) * 100);
  const rateText = `${percent >= 0 ? "+" : ""}${percent}%`;

  const done = new Promise<void>((resolve, reject) => {
    workerPending.set(id, { resolve, reject });
    setTimeout(() => {
      if (workerPending.has(id)) {
        workerPending.delete(id);
        reject(new Error("edge-tts 合成超时"));
      }
    }, 30000);
  });

  proc.stdin?.write(
    JSON.stringify({ id, text, voice, rate: rateText, out }) + "\n",
  );
  await done;
  const audio = await readFile(out);
  await unlink(out).catch(() => undefined);
  return audio;
}

export type TtsVoice = {
  id: string;
  name: string;
  gender: "female" | "male";
  /** 云端是否支持语速调节 */
  supportsRate: boolean;
};

// 百度翻译免费发音：无需密钥，国内可直连；音色为固定中文女声
const BAIDU_VOICE: TtsVoice = {
  id: "baidu-female",
  name: "中文女声",
  gender: "female",
  supportsRate: true,
};

const AZURE_VOICES: TtsVoice[] = [
  { id: "zh-CN-XiaoxiaoNeural", name: "晓晓", gender: "female", supportsRate: true },
  { id: "zh-CN-XiaoyiNeural", name: "晓伊", gender: "female", supportsRate: true },
  { id: "zh-CN-YunxiNeural", name: "云希", gender: "male", supportsRate: true },
  { id: "zh-CN-YunjianNeural", name: "云健", gender: "male", supportsRate: true },
  { id: "zh-CN-YunyangNeural", name: "云扬", gender: "male", supportsRate: true },
];

const EDGE_VOICES: TtsVoice[] = [
  { id: "zh-CN-XiaoxiaoNeural", name: "晓晓 · 温和", gender: "female", supportsRate: true },
  { id: "zh-CN-XiaoyiNeural", name: "晓伊 · 活泼", gender: "female", supportsRate: true },
  { id: "zh-CN-YunxiNeural", name: "云希 · 轻快", gender: "male", supportsRate: true },
  { id: "zh-CN-YunjianNeural", name: "云健 · 沉稳", gender: "male", supportsRate: true },
  { id: "zh-CN-YunyangNeural", name: "云扬 · 播音", gender: "male", supportsRate: true },
  { id: "zh-CN-YunxiaNeural", name: "云夏 · 少年", gender: "male", supportsRate: true },
];

export function azureConfigured(): boolean {
  return Boolean(process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION);
}

/** 云端语音提供商：Azure 优先，其次本机 edge-tts，最后百度免费发音 */
export function ttsProvider(): "azure" | "edge" | "baidu" {
  if (azureConfigured()) return "azure";
  if (edgeTtsEnabled()) return "edge";
  return "baidu";
}

/** 本机装有 edge-tts 时启用（安装：pip install edge-tts） */
function edgeTtsEnabled(): boolean {
  return process.env.EDGE_TTS_DISABLED !== "1";
}

export const TTS_VOICES: TtsVoice[] = [...EDGE_VOICES, BAIDU_VOICE, ...AZURE_VOICES];

/** 当前提供商实际可用的音色 */
export function availableVoices(): TtsVoice[] {
  const provider = ttsProvider();
  if (provider === "azure") return [...AZURE_VOICES, BAIDU_VOICE];
  if (provider === "edge") return EDGE_VOICES;
  return [BAIDU_VOICE];
}

export function isTtsVoice(value: unknown): value is string {
  return TTS_VOICES.some((v) => v.id === value);
}

/** 百度发音接口直接返回 mp3，最长约 1000 字 */
async function baiduSpeech(text: string, rate: number): Promise<Buffer> {
  const spd = Math.min(9, Math.max(1, Math.round(5 * rate)));
  const url =
    "https://fanyi.baidu.com/gettts?lan=zh&source=web&spd=" +
    spd +
    "&text=" +
    encodeURIComponent(text);

  return new Promise<Buffer>((resolve, reject) => {
    const req = https.get(
      url,
      {
        timeout: 15000,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
          Referer: "https://fanyi.baidu.com/",
        },
      },
      (res) => {
        const contentType = res.headers["content-type"] ?? "";
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          const body = Buffer.concat(chunks);
          if (res.statusCode !== 200 || !contentType.includes("audio")) {
            reject(new Error(`百度语音合成失败（HTTP ${res.statusCode}）`));
            return;
          }
          resolve(body);
        });
      },
    );
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("百度语音合成超时"));
    });
    req.on("error", (err) => reject(err));
  });
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function azureSpeech(
  text: string,
  voice: string,
  rate: number,
): Promise<Buffer> {
  const key = process.env.AZURE_SPEECH_KEY as string;
  const region = process.env.AZURE_SPEECH_REGION as string;
  const percent = Math.round((rate - 1) * 100);
  const ssml =
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="zh-CN">` +
    `<voice name="${escapeXml(voice)}">` +
    `<prosody rate="${percent >= 0 ? "+" : ""}${percent}%">${escapeXml(text)}</prosody>` +
    `</voice></speak>`;

  const res = await fetch(
    `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,
    {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": key,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
        "User-Agent": "folio-reader",
      },
      body: ssml,
    },
  );

  if (!res.ok) {
    throw new Error(`Azure 语音合成失败（HTTP ${res.status}）`);
  }
  return Buffer.from(await res.arrayBuffer());
}

/** 本机 edge-tts（Python）命令行兜底合成，返回 mp3 */
async function edgeCliSpeech(
  text: string,
  voice: string,
  rate: number,
): Promise<Buffer> {
  const percent = Math.round((rate - 1) * 100);
  const args = [
    "-m",
    "edge_tts",
    "--voice",
    voice,
    "--rate",
    `${percent >= 0 ? "+" : ""}${percent}%`,
    "--text",
    text,
  ];
  const candidates = edgePython
    ? [edgePython]
    : [process.env.EDGE_TTS_PYTHON, "python", "py"].filter(
        (v): v is string => Boolean(v),
      );

  let lastError: unknown = null;
  for (const python of candidates) {
    const file = path.join(
      tmpdir(),
      `folio-tts-${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`,
    );
    try {
      await execFileAsync(python, [...args, "--write-media", file], {
        timeout: 30000,
        windowsHide: true,
        maxBuffer: 1024 * 1024,
      });
      const audio = await readFile(file);
      edgePython = python;
      return audio;
    } catch (err) {
      lastError = err;
    } finally {
      await unlink(file).catch(() => undefined);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("edge-tts 不可用");
}

const cacheDir = path.join(tmpdir(), "folio-tts-cache");

/** edge-tts 合成：优先复用磁盘缓存，其次走常驻进程，最后退回命令行 */
async function edgeSpeech(
  text: string,
  voice: string,
  rate: number,
): Promise<Buffer> {
  const key = createHash("sha1").update(`${voice}|${rate}|${text}`).digest("hex");
  const cacheFile = path.join(cacheDir, `${key}.mp3`);
  try {
    const cached = await readFile(cacheFile);
    if (cached.length > 0) return cached;
  } catch {
    // 未命中缓存
  }

  let audio: Buffer;
  try {
    audio = await workerSpeech(text, voice, rate);
  } catch (err) {
    console.error("[tts] 常驻进程失败，改用命令行：", err);
    audio = await edgeCliSpeech(text, voice, rate);
  }

  await mkdir(cacheDir, { recursive: true }).catch(() => undefined);
  await writeFile(cacheFile, audio).catch(() => undefined);
  return audio;
}

export async function synthesizeSpeech(
  text: string,
  voice: string,
  rate: number,
): Promise<Buffer> {
  const provider = ttsProvider();
  try {
    if (provider === "azure") return await azureSpeech(text, voice, rate);
    if (provider === "edge") return await edgeSpeech(text, voice, rate);
  } catch (err) {
    // 云端失败时退化到百度免费发音，保证总能出声
    console.error("[tts] edge 合成失败：", err);
  }
  return baiduSpeech(text, rate);
}
