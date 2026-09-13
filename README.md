# LYCEUM CLASH — Colyseus Server

Це окремий multiplayer-сервер для LYCEUM CLASH. Firebase для кімнат гри тут не використовується.

## Що вже є

- 5-символьні коди кімнат.
- До 5 реальних гравців.
- HOST та передача HOST, якщо він виходить.
- Серверний START для всіх гравців одночасно.
- Авторитетний серверний рух.
- Постріли, HP, KO, respawn.
- 75-секундний матч.
- Центральна зона дає +1 бал/сек.
- WebSocket snapshots ~20 разів/с.
- Тестова сторінка `/test`, щоб перевірити два телефони ДО інтеграції в портал.
- Health endpoint `/health`.

## Локальний запуск

Потрібен Node.js 20+.

```bash
npm install
npm start
```

Відкрити:

- http://localhost:2567/test

## Деплой на Render

### Варіант 1 — через GitHub + Web Service

1. Створи новий GitHub-репозиторій, наприклад `lyceum-clash-server`.
2. Завантаж УСІ файли з цього ZIP у корінь репозиторію.
3. На Render: `New` → `Web Service`.
4. Підключи GitHub-репозиторій.
5. Render має визначити Node.js.
6. Build Command: `npm install`
7. Start Command: `npm start`
8. Deploy.

Після запуску Render дасть адресу на кшталт:

`https://lyceum-clash-server.onrender.com`

Перевір:

- `https://...onrender.com/health`
- `https://...onrender.com/test`

## Перший тест на 2 пристроях

1. Відкрий `/test` на телефоні/ПК №1.
2. Натисни `СТВОРИТИ`.
3. Побачиш 5-символьний код.
4. Відкрий той самий `/test` на пристрої №2.
5. Введи код → `ПРИЄДНАТИСЯ`.
6. На обох екранах повинні з'явитися 2 гравці.
7. HOST натискає `ПОЧАТИ МАТЧ`.
8. Обидва екрани повинні перейти в стан `Матч`.
9. Перевір рух і постріли.

Цей тест НЕ використовує Firebase і НЕ залежить від Google-акаунтів.

## Наступний крок

Після успішного тесту `/test` треба підключити твій існуючий `index.html` LYCEUM CLASH до Render/Colyseus:
- Create Room → `client.create("lyceum_clash")`
- Join by code → `client.joinById(code)`
- START → `room.send("start")`
- movement → `room.send("input", ...)`
- fire → `room.send("shoot", ...)`
- players/state → `snapshot` messages

Firebase на порталі залишається для:
- Google login;
- рейтингу;
- Portal Coins;
- щотижневого переможця;
- інших активностей.
