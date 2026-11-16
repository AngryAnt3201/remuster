#!/bin/zsh
# Renders the launch video. Usage: ./render.sh [comp...]   (Launch, LaunchNoVO, LaunchSilent; default Launch)
#   node cuts.mjs runs first: it lists the captures that exist and stages the voice-over and font.
cd "$(dirname "$0")"
(cd .. && npx vite-node video/cuts.mjs) || exit 1
# the soundtrack for this cut (stems are fixed; only the cut list changes)
[ audio/soundtrack.wav -nt audio/cuts.json ] || (cd .. && python3 tools/music/mix.py video/audio/cuts.json video/audio/soundtrack.wav) || exit 1
mkdir -p public/audio && cp audio/soundtrack.wav public/audio/soundtrack.wav
B=$(ls -d ~/Library/Caches/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-mac-arm64/chrome-headless-shell 2>/dev/null | tail -1)
mkdir -p out
for comp in ${@:-Launch}; do
  lockf -k ~/Desktop/game_development/.heavy.lock nice -n 10 npx remotion render src/index.ts $comp out/$comp.mp4 --concurrency=4 --codec=h264 --crf=18 --browser-executable=$B --log=info || exit 1
done
