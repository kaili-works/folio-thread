import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import {
  availableVoices,
  isTtsVoice,
  synthesizeSpeech,
  TTS_VOICES,
  ttsProvider,
} from "@/lib/tts";
import { tApi } from "@/lib/api-messages";
import { getRequestLocale } from "@/lib/request-locale";

export const runtime = "nodejs";

const MAX_CHARS = 800;

// 前端据此决定用云端语音还是浏览器内置语音
export async function GET() {
  return NextResponse.json({
    provider: ttsProvider(),
    voices: availableVoices(),
  });
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const locale = await getRequestLocale();
    if (!rateLimit(`tts:${user.id}`, 20, 60_000)) {
      return NextResponse.json(
        { error: tApi(locale, "语音请求过于频繁，请稍后再试") },
        { status: 429 },
      );
    }

    const body = await request.json().catch(() => null);
    const text: string = (body?.text ?? "").toString().trim();
    const voice = isTtsVoice(body?.voice) ? body.voice : availableVoices()[0].id;
    const rawRate = Number(body?.rate);
    const rate = Number.isFinite(rawRate)
      ? Math.min(2, Math.max(0.5, rawRate))
      : 1;

    if (!text) {
      return NextResponse.json({ error: tApi(locale, "缺少文本") }, { status: 400 });
    }
    if (text.length > MAX_CHARS) {
      return NextResponse.json(
        {
          error:
            locale === "en"
              ? `Paragraph too long (max ${MAX_CHARS} characters)`
              : `单段文本过长（上限 ${MAX_CHARS} 字）`,
        },
        { status: 400 },
      );
    }

    const audio = await synthesizeSpeech(text, voice, rate);
    if (audio.length === 0) {
      return NextResponse.json({ error: tApi(locale, "语音合成结果为空") }, { status: 502 });
    }

    return new NextResponse(new Uint8Array(audio), {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(audio.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 502;
    const message = err instanceof Error ? err.message : "语音合成失败";
    return NextResponse.json({ error: message }, { status });
  }
}
