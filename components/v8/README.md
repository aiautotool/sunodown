# v8 Lyrics Sync

Uses Suno word-level aligned lyrics when available. Lyrics text remains authoritative; timestamps drive display. Legacy duration/line-count timing must not be used for aligned tracks.

Pipeline: Suno aligned words -> normalize -> match original clean lyrics -> line/word timeline -> frame renderer. If alignment is unavailable, do not claim exact synchronization.

Status: alignment parser, proxy route, timeline utilities and synced-render facade implemented.
