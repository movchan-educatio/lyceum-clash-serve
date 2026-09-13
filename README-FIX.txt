LYCEUM CLASH SERVER FIX 1.2

ПРИЧИНА:
У тестовій сторінці був CDN:
@colyseus/sdk@0.18.5

А клієнтський пакет @colyseus/sdk має актуальну версію 0.18.2.
Через це SDK не завантажувався, JS падав на Colyseus.Client,
і кнопки СТВОРИТИ / ПРИЄДНАТИСЯ взагалі не отримували onclick.

FIX:
- browser client завантажується через:
  https://esm.sh/@colyseus/sdk@0.18.2
- якщо SDK не завантажиться, тепер на сторінці буде видима помилка.
- кнопки показують CREATE ERROR / JOIN ERROR замість мовчазного зависання.

ЩО ЗРОБИТИ:
1. У GitHub замінити main.js на цей.
2. Commit changes.
3. Render автоматично зробить deploy, або Manual Deploy -> Deploy latest commit.
4. Відкрити /test.
5. Має з'явитися:
   SDK завантажено • можна створювати кімнату
