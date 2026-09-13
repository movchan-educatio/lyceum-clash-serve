LYCEUM CLASH SERVER v2.2 — ORIGINAL LOOK + STABLE ROOMS

WHY
v2.1 multiplayer worked for HOST, but another account could fail to join and the standalone game's look was too different from the original portal game.

FIXES
- Restored the known-working 5-character uppercase room-code architecture:
  ABCDE...234...
- Join sanitizes the code to exactly 5 uppercase characters.
- 8 original LYCEUM CLASH arenas:
  Central Hall, Library, Gym, Science, Yard, History Gallery, Media Center, Auditorium.
- SMART BOTS remain server authoritative.
- Human movement, shots, HP, KO, respawn, score remain server authoritative.
- Portal hero/skin/weapon/weapon finish/perk are passed into the Colyseus game.
- Cosmetics are visible in battle.
- UI is reskinned to the original LYCEUM CLASH / ARENA XL visual language:
  compact dark lobby, 5 slots, compact game HUD, old-style joystick/FIRE/SUPER.
- The portal's original hero/shop menu remains the primary menu; the embedded game opens the compact room/lobby instead of trying to replace the portal identity.

DEPLOY
Replace in the Render server GitHub repo:
main.js
game.html
package.json
render.yaml
.node-version

Then deploy latest commit.
