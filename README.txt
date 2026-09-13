LYCEUM CLASH — COLYSEUS FULL GAME v2.0

ЩО ЦЕ
Окрема повноцінна тестова версія LYCEUM CLASH на вже робочому Colyseus-сервері.
Firebase для multiplayer не використовується.

ЩО Є
- нормальне HOME-меню;
- 17 героїв;
- lobby з 5 слотами;
- 3 арени: хол, бібліотека, спортзал;
- SMART BOTS, які працюють НА СЕРВЕРІ і синхронізуються всім;
- до 5 бійців одночасно;
- 75-секундний матч;
- центральна зона з балами;
- HP, шкода, KO, respawn;
- SUPER;
- auto-aim;
- mobile joystick;
- FIRE / SUPER;
- WASD / стрілки / Space / E;
- particles, tracers, damage text, screen shake, WebAudio effects;
- результат матчу;
- server-authoritative movement, shots, bots and scores.

ВАЖЛИВО
Це НЕ заміна основного порталу. Спочатку тестуємо /game на 2 пристроях.
Коли все стабільно — переносимо цей Colyseus-клієнт у твій index.html порталу.

ЯК ОНОВИТИ GITHUB
У корені lyceum-clash-server заміни/додай:
- main.js
- game.html
- package.json
- render.yaml
- .node-version

Commit changes.

RENDER
NODE_VERSION = 22.22.0
Build Command = npm install
Start Command = npm start

Після Live відкрий:
https://lyceum-clash-serve.onrender.com/game?v=200

ТЕСТ
1. Пристрій 1: Створити кімнату.
2. Пристрій 2: ввести код та приєднатися.
3. HOST вибирає карту, SMART BOTS ON.
4. START.
5. Обидва пристрої мають бачити однакових людей + ботів.
6. Перевірити joystick/WASD, FIRE, HP, KO, SUPER, результати.
