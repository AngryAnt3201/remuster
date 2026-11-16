#!/bin/sh
# Placeholder voice-over from the Mac's built-in voice: one WAV per line of vo/script.json.
# A real recording replaces these file for file (same names); lines already recorded by a person are never
# overwritten unless you pass --force (placeholders carry a ".placeholder" marker beside them).
cd "$(dirname "$0")"
FORCE=$1
python3 - "$FORCE" <<'PY'
import json, os, subprocess, sys
force = len(sys.argv) > 1 and sys.argv[1] == "--force"
s = json.load(open("script.json"))
for l in s["lines"]:
    wav, mark = f"{l['id']}.wav", f"{l['id']}.placeholder"
    if os.path.exists(wav) and not os.path.exists(mark) and not force:
        print("kept (recorded):", wav); continue
    subprocess.run(["say", "-v", s["voice"], "-r", str(s["rate"]), "-o", "tmp.aiff", l["text"]], check=True)
    # tidy the synthetic voice a little: trim silence, gentle high-pass, normalise loudness
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", "tmp.aiff", "-af",
        "silenceremove=start_periods=1:start_threshold=-50dB,highpass=f=90,loudnorm=I=-16:TP=-1.5:LRA=7", "-ar", "48000", "-ac", "1", wav], check=True)
    open(mark, "w").write("built-in voice; replace with a recording\n")
    d = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", wav], capture_output=True, text=True).stdout)
    print(f"{wav}: {d:.2f} s  (bar {l['bar']})  {l['text']}")
os.remove("tmp.aiff") if os.path.exists("tmp.aiff") else None
PY
