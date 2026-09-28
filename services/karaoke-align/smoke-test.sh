#!/bin/sh
# Run on VPS: sh smoke-test.sh /path/to/audio.wav
set -eu
cd /opt/sunodown-karaoke-align
set -a
. ./.env
set +a
curl --fail-with-body --max-time 600 \
  http://203.24.89.20/api/karaoke/align \
  -H "Authorization: Bearer $KARAOKE_ALIGN_TOKEN" \
  -F "audio=@${1:?Pass an audio file path}" \
  -F duration=24 -F language=vi
