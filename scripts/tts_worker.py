"""常驻 edge-tts 工作进程：从 stdin 逐行读取 JSON 任务，合成 mp3 到指定路径。

一次性启动后复用，避免每次分段朗读都重新启动 Python（约 0.8–1 秒开销）。
"""
import asyncio
import json
import sys

import edge_tts


async def synth(text: str, voice: str, rate: str, out: str) -> None:
    communicate = edge_tts.Communicate(text, voice, rate=rate)
    await communicate.save(out)


def main() -> None:
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            job = json.loads(line)
            asyncio.run(synth(job["text"], job["voice"], job["rate"], job["out"]))
            sys.stdout.write(json.dumps({"id": job["id"], "ok": True}) + "\n")
        except Exception as exc:  # noqa: BLE001
            sys.stdout.write(
                json.dumps({"id": job.get("id") if isinstance(job, dict) else None, "ok": False, "error": str(exc)})
                + "\n"
            )
        sys.stdout.flush()


if __name__ == "__main__":
    main()
