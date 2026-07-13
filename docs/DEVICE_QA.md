# Device QA Runbook

Use the production frontend on one laptop and two physical phones. Do not mark the physical milestones complete until this runbook passes.

## Matrix

Run at least these combinations:

| Laptop | Player 1 | Player 2 |
|---|---|---|
| Chrome desktop | Chrome Android | Safari iOS |
| Safari desktop | Safari iOS | Chrome Android |

## Preconditions

- Render `/ready` returns `200`.
- Vercel `/display` loads over HTTPS.
- Both phones have screen rotation locked to portrait.
- Camera and motion permissions can be granted.
- Record each phone model, OS, browser version, and network.

## Five-minute round

1. Laptop creates a room and enables webcam.
2. Both phones scan the same QR and receive distinct P1/P2 roles.
3. Record each controller's RTT badge at start, midpoint, and finish.
4. Rotate both phones to landscape; verify touchpad and Fire remain visible with no page scroll.
5. Enable motion, verify beta/gamma changes, then verify local radar and laptop crosshair move together.
6. Move to all four corners; note inversion, clipping, dead zones, and drift.
7. Recenter both controllers three times.
8. Shoot red with P1, cyan with P2, and three green combo targets together.
9. Empty and reload both magazines manually; then test one shake reload each.
10. Disconnect Wi-Fi on one phone for five seconds, reconnect, and verify auto-pause/token reclaim/safe resume.
11. Finish one uninterrupted round and capture debrief.

## Acceptance criteria

- No refresh is required.
- No phone steals the other player's slot.
- Median displayed RTT is at most 220 ms; no sustained `POOR` longer than 10 seconds.
- Crosshair follows the same direction as the phone and reaches the playable area.
- Idle drift after 60 seconds is less than 10% of screen width/height.
- Recenter returns aim within 5% of center.
- Normal aiming causes zero false shake reloads.
- Reconnect restores the same player within 10 seconds.
- One complete round finishes without a server/client crash.

## Result template

```text
Date:
Laptop/browser:
P1 device/browser:
P2 device/browser:
Network:
RTT start/mid/end P1:
RTT start/mid/end P2:
Drift after 60s P1/P2:
False shake reloads:
Reconnect duration P1/P2:
Round completed: yes/no
Blockers:
Tuning notes:
```

## Tuning decisions

Only change sensitivity, smoothing, dead zone, shake threshold, or difficulty from measured results above. Keep Android and iOS notes separate.
