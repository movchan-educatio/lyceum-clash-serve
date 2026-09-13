LYCEUM CLASH SERVER FIX 1.4.1 — NODE 22

ПРИЧИНА:
Render запустив сервер на Node.js v26.8.2.
У package.json було engines.node = ">=20", а Render попереджає, що такий
необмежений діапазон може автоматично перейти на найновішу major-версію Node.

Для стабільності Colyseus 0.18 сервер тепер зафіксований на Node 22.22.0.

ЩО ЗАМІНИТИ У GITHUB:
- main.js
- package.json
- render.yaml
- додати .node-version

ДОДАТКОВО У RENDER:
Settings / Environment -> NODE_VERSION = 22.22.0

Після цього Manual Deploy -> Clear build cache & deploy / Deploy latest commit.
У логах має бути Node 22.22.0, НЕ Node 26.
