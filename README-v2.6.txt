LYCEUM CLASH v2.6 — PROGRESSION & CONTENT

Основа:
- стабільний Colyseus multiplayer;
- 5-символьні коди кімнат;
- server-authoritative movement/combat/bots;
- 8 арен;
- 17 героїв;
- Portal Coins через портал.

НОВЕ У v2.6

1. ПРОГРЕС ГЕРОЇВ
- XP після матчу.
- Hero Level.
- Mastery за конкретного героя.
- Серія перемог.
- Favorite Hero.
- K/D.
- Прогрес не додає pay-to-win шкоди/HP.

2. МАГАЗИН
За Portal Coins:
- hero skins;
- weapon skins;
- shot effects;
- KO effects;
- profile frames;
- cosmetic trails.
Купівля/екіпірування зберігається через portal-score.js.

3. LOADOUT
Перед матчем портал передає:
Hero -> Skin -> Weapon -> Weapon Finish -> Perk
+ Shot Effect / KO Effect / Frame / Trail.

4. РЕЖИМИ
- CLASH
- КОНТРОЛЬ ДЗВОНУ
- КОМАНДНИЙ 2v2
- ОСТАННІЙ УЧЕНЬ
3v3 залишено на наступний етап, як і планувалось.

5. ІНТЕРАКТИВНІ КАРТИ
Під час матчу:
- двері можуть закриватися/відкриватися;
- світло може гаснути;
- рухоме укриття;
- тимчасові cover blocks;
- центральна подія дзвону;
- energy pads.

6. LOBBY / MATCHMAKING
- Ready статус.
- HOST видно окремо.
- Quick Match.
- режим гри;
- складність ботів;
- повторний матч однією кнопкою.

7. ПІСЛЯМАТЧЕВИЙ ЕКРАН
Показує:
- місце;
- KO;
- deaths;
- damage;
- control time;
- XP;
- рівень героя;
- Portal Coins;
- завершені місії.

8. СТАТИСТИКА
Зберігається:
- wins;
- matches;
- kills/deaths;
- K/D;
- damage;
- control time;
- favorite hero;
- win streak;
- best score.

9. DAILY / WEEKLY MISSIONS
Приклади:
- зіграти 3 матчі;
- перемогти;
- зробити KO;
- контролювати дзвін;
- використати різних героїв/режими.
Нагороди — Portal Coins.

10. OPTIMIZATION v2
- adaptive graphics;
- FPS monitor тільки ?debug=1;
- cached arena rendering;
- snapshot interpolation;
- limited DPR;
- FX scaling;
- менше навантаження на старі телефони.

DEPLOY SERVER
Замінити у GitHub Render-сервера:
main.js
game.html
package.json
render.yaml
.node-version
Commit -> Render Live.
