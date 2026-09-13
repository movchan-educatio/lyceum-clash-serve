LYCEUM CLASH SERVER FIX 1.4.2

ТОЧНА ПРИЧИНА ПОМИЛКИ RENDER:
SyntaxError: Unexpected identifier 'input'

TEST_HTML у main.js зберігається всередині server-side template string (`...`).
У попередньому 1.4 debug-коді всередину нього випадково потрапили ще одні
JavaScript template literals з backticks, наприклад:
  `input: ${...}`

Вони передчасно закривали TEST_HTML і ламали синтаксис main.js на Render.

FIX 1.4.2:
- усі browser debug-рядки переписані на звичайну конкатенацію;
- всередині TEST_HTML немає жодного nested backtick;
- немає ${...} interpolation;
- Node 22.22.0 зафіксований;
- /test no-cache;
- рух дозволений у lobby;
- input_ack показує, чи сервер отримує команди;
- сторінка має видимий маркер v1.4.2.

ЩО РОБИТИ:
1. Замінити у GitHub:
   main.js
   package.json
   render.yaml
   .node-version
2. Commit.
3. Render -> Deploy latest commit.
4. Після Live відкрити на ОБОХ пристроях:
   https://lyceum-clash-serve.onrender.com/test?v=142
5. Переконатися, що на обох видно v1.4.2.
6. Рух можна тестувати ще ДО START.
