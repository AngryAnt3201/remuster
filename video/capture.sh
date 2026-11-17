#!/bin/zsh
# Records every clip the edit needs for one game: ./video/capture.sh <game> [port]
# Builds the game, serves the build, films the scenes on the virtual clock (tools/film.mjs) and stops the server.
# Clips land in video/public/clips/<game>/. About ten minutes a game; runs under the shared heavy-job lock.
game=${1:?usage: video/capture.sh <game> [port]}
port=${2:-5330}
cd "$(dirname "$0")/.."
# Film a built copy, not the dev server: a source edit elsewhere would hot-reload the page mid-capture.
out=dist-games/$game; [ $game = base ] && out=dist
GAME=$game lockf -k ~/Desktop/game_development/.heavy.lock nice -n 10 npx vite build > /tmp/remuster-capture-$game.log 2>&1 || { tail -5 /tmp/remuster-capture-$game.log; exit 1; }
GAME=$game npx vite preview --host 127.0.0.1 --port $port --strictPort --outDir $out >> /tmp/remuster-capture-$game.log 2>&1 &
server=$!
trap "kill $server 2>/dev/null" EXIT
for i in {1..60}; do curl -s -o /dev/null http://127.0.0.1:$port/ && break; sleep 0.5; done
film() { lockf -k ~/Desktop/game_development/.heavy.lock nice -n 10 node tools/film.mjs --game $game --port $port --out video/public/clips "$@" | tail -1; }
film --scene clash --seconds 28
film --scene arena --seconds 20
film --scene siege --seconds 16
film --scene crossing --seconds 16
film --scene market --seconds 16
film --url "/?demo" --name home --seconds 8
film --url "/?demo&tab=army" --name army --seconds 3
