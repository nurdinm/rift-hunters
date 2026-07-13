# Rift Hunters: Dual Frequency

> **Status terbaru:** MVP fungsional sudah diimplementasikan di `/Users/muhammadnurdin/rift-hunters`. Jalur create room hingga game over tersedia. Progres keseluruhan sekitar **80% dari MVP**; QA perangkat nyata, audio, tutorial, automated tests, dan deployment HTTPS masih menjadi backlog.

## Status Singkat

| Area | Status | Catatan |
|---|---|---|
| Fondasi monorepo | Selesai | React, Vite, TypeScript, Node.js, dan shared protocol tersedia. |
| Room dan realtime | Selesai | Create/join, QR, dua pemain, token reconnect, dan cleanup tersedia. |
| Controller HP | Selesai | Gyroscope, izin iOS, recenter, trigger, vibration, dan touch fallback tersedia. |
| Display laptop | Selesai | Webcam, HUD, QR, crosshair, lobby, pause, dan hasil akhir tersedia. |
| Core gameplay | Selesai | Target merah/biru/combo, score, shield, timer, dan hit detection tersedia. |
| Game feel | Parsial | Visual dasar tersedia; audio, trail, dan camera shake belum lengkap. |
| QA/deployment | Parsial | Build dan config tersedia; QA perangkat dan deployment publik belum selesai. |
| Automated tests | Parsial | Unit game logic dan integration test lifecycle Socket.IO tersedia. |

Rencana pengembangan game AR berbasis web untuk dua pemain, dengan laptop sebagai layar utama dan dua HP sebagai motion controller.

## 1. Target MVP

Satu sesi dimainkan oleh dua pemain menggunakan:

- 1 laptop dengan webcam sebagai layar utama.
- 2 HP sebagai motion controller.
- Semua perangkat terhubung melalui browser tanpa instalasi.
- Laptop membuat room dan menampilkan QR code.
- HP mengontrol crosshair menggunakan gyroscope.
- Pemain menekan trigger untuk menembak.
- Musuh merah, biru, dan combo muncul di atas video webcam.
- Satu permainan berlangsung sekitar 3-5 menit.

MVP dianggap berhasil jika dua pemain dapat bergabung, membidik dengan nyaman, dan menyelesaikan satu ronde dari awal hingga akhir.

## 2. Arsitektur

```text
             Room code / QR
                    |
        +-----------+-----------+
        |                       |
   HP Player 1             HP Player 2
 Gyro + trigger           Gyro + trigger
        |                       |
        +------ Socket.IO ------+
                    |
             Node.js Server
                    |
             Laptop Display
       Webcam + game + audio
```

### Stack Teknologi

- **Frontend:** Vite, React, dan TypeScript.
- **Game rendering aktual:** React dan CSS overlay di atas webcam; Phaser 3 ditunda.
- **Realtime communication:** Node.js dan Socket.IO.
- **QR generator:** `qrcode.react`.
- **Testing:** Vitest.
- **Deployment:** Vercel atau Netlify untuk client; Railway atau Render untuk server.
- **AR lanjutan:** Three.js atau MindAR setelah MVP stabil.

React dan CSS overlay dipakai agar MVP tetap ringan. Phaser 3, Three.js, atau MindAR hanya ditambahkan jika kebutuhan gameplay atau tracking 3D sudah tervalidasi.

## 3. Struktur Aplikasi

Gunakan satu repository dengan struktur berikut:

```text
rift-hunters/
|-- apps/
|   |-- client/
|   |   |-- display/       # UI laptop
|   |   |-- controller/    # UI HP
|   |   `-- shared/
|   `-- server/            # Socket.IO dan room state
|-- packages/
|   `-- protocol/          # Tipe event dan payload bersama
|-- package.json
`-- README.md
```

### Route Utama

```text
/                 Landing page
/display          Membuat atau membuka room di laptop
/controller/:room Bergabung dari HP
```

## 4. Aturan Permainan

Terdapat tiga tipe musuh:

- **Merah:** hanya dapat dihancurkan Player 1.
- **Biru:** hanya dapat dihancurkan Player 2.
- **Combo:** harus ditembak kedua pemain dalam selang maksimal 1 detik.

### Sistem Skor

- Musuh biasa: `+100`.
- Combo berhasil: `+300`.
- Tembakan meleset: `-10`.
- Musuh lolos: mengurangi satu health.
- Game berakhir ketika timer habis atau health menjadi nol.

### Kontrol HP

- Miringkan HP untuk menggerakkan crosshair.
- Tekan atau tahan trigger untuk menembak.
- Gunakan tombol `Recenter` untuk menetapkan orientasi saat ini sebagai titik tengah.
- Reload menggunakan tombol untuk MVP; gesture shake dapat ditambahkan kemudian.
- Vibration memberikan feedback ketika hit, miss, atau combo berhasil.

## 5. Event Realtime

Kontrak event ditentukan sebelum pembuatan UI:

```ts
type ClientToServerEvents = {
  "room:create": (
    callback: (result: { roomCode: string }) => void
  ) => void;

  "room:join": (
    data: { roomCode: string; role: "display" | "player" },
    callback: (result: { ok: boolean; playerId?: 1 | 2 }) => void
  ) => void;

  "controller:aim": (data: {
    roomCode: string;
    playerId: 1 | 2;
    x: number;
    y: number;
    sequence: number;
  }) => void;

  "controller:shoot": (data: {
    roomCode: string;
    playerId: 1 | 2;
    sequence: number;
    clientTime: number;
  }) => void;

  "controller:recenter": (data: {
    roomCode: string;
    playerId: 1 | 2;
  }) => void;
};
```

### Tanggung Jawab Server

- Membuat dan memvalidasi room.
- Mengalokasikan Player 1 dan Player 2.
- Menyimpan status koneksi.
- Mengelola skor, health, timer, dan hit detection.
- Membatasi spam event.
- Memvalidasi jendela waktu target combo.

### Tanggung Jawab Laptop

- Meminta dan menampilkan webcam.
- Merender game, crosshair, dan efek visual.
- Memutar audio.
- Menampilkan state resmi dari server.

## 6. Tahapan Pengerjaan

### Fase 0 - Validasi Teknis

Buat prototype kecil sebelum game lengkap:

- Laptop membuat room.
- HP bergabung melalui kode atau QR.
- Data gyroscope HP menggerakkan titik pada laptop.
- Tombol trigger mengubah warna titik.
- Uji dua HP secara bersamaan.
- Ukur latency dan kestabilan selama 5 menit.

**Kriteria lolos:** aim terasa cukup responsif dan koneksi tidak sering terputus.

### Fase 1 - Fondasi Proyek

- Setup monorepo dan TypeScript.
- Buat client dan Socket.IO server.
- Definisikan protocol bersama.
- Tambahkan routing untuk display dan controller.
- Buat room lifecycle dan reconnection sederhana.
- Tambahkan konfigurasi environment.

### Fase 2 - Controller HP

- Tambahkan permission sensor untuk Android dan iOS.
- Baca `DeviceOrientationEvent`.
- Petakan yaw dan pitch menjadi koordinat layar.
- Tambahkan smoothing untuk mengurangi jitter.
- Buat tombol trigger dan recenter.
- Tampilkan status koneksi dan nomor pemain.
- Sediakan touchpad sebagai fallback jika sensor tidak tersedia.

### Fase 3 - Display Laptop

- Tambahkan permission dan preview webcam.
- Buat game canvas fullscreen di atas video.
- Tampilkan QR dan room code.
- Tampilkan dua crosshair dengan warna berbeda.
- Tampilkan status koneksi setiap pemain.
- Tambahkan menu start, pause, restart, dan exit.
- Tangani kegagalan webcam atau koneksi.

### Fase 4 - Core Gameplay

- Buat sistem spawn wave.
- Tambahkan target merah, biru, dan combo.
- Terapkan server-authoritative hit detection.
- Tambahkan score, health, timer, dan game-over.
- Tambahkan difficulty scaling sederhana.
- Buat satu ronde lengkap selama 3-5 menit.

### Fase 5 - Game Feel

- Tambahkan animasi portal.
- Tambahkan hit flash dan projectile trail.
- Tambahkan audio shoot, hit, combo, dan warning.
- Aktifkan vibration pada HP.
- Tambahkan countdown dan hasil akhir.
- Tambahkan camera shake ringan pada display.
- Buat tutorial satu ronde.

### Fase 6 - QA dan Deployment

- Uji Chrome Android, Safari iOS, dan browser laptop.
- Uji berbagai rasio layar dan rotasi HP.
- Uji reconnect dan room cleanup.
- Deploy menggunakan HTTPS.
- Tambahkan logging error tanpa data sensitif.
- Tambahkan halaman instruksi singkat.

## 7. Estimasi Sprint

### Sprint 1 - Proof of Concept (2-3 hari)

- Room dan QR.
- Satu HP terhubung.
- Gyroscope menggerakkan crosshair.
- Trigger berfungsi.

### Sprint 2 - Multiplayer (2-3 hari)

- Dua HP terhubung.
- Player assignment.
- Reconnect.
- Smoothing dan recenter.
- Touch fallback.

### Sprint 3 - Gameplay (3-5 hari)

- Webcam sebagai background.
- Target dan hit detection.
- Wave, score, health, dan timer.
- Combo mechanic.

### Sprint 4 - Polish dan Deployment (3-5 hari)

- Visual, suara, dan vibration.
- Tutorial.
- Mobile dan browser QA.
- Deployment HTTPS.

Estimasi total MVP untuk satu developer adalah sekitar **2-3 minggu**. Prototype teknis dapat didemokan dalam beberapa hari.

## 8. Risiko dan Mitigasi

| Risiko | Mitigasi |
|---|---|
| Gyroscope drift | Tambahkan recenter, dead zone, smoothing, dan periodic correction. |
| Permission sensor iOS | Minta izin hanya setelah tombol `Enable Motion` ditekan. |
| Network latency | Batasi aim menjadi 20-30 event per detik dan lakukan interpolasi pada display. |
| Sensor tidak tersedia | Sediakan virtual touchpad. |
| Hit detection tidak konsisten | Jadikan server sebagai sumber kebenaran. |
| Webcam ditolak | Tampilkan panduan permission dan tombol retry. |
| Room ditinggalkan | Hapus room setelah semua perangkat disconnect dalam batas waktu tertentu. |
| Hosting masuk mode sleep | Gunakan layanan WebSocket stabil atau jaringan lokal ketika demo. |

## 9. Definition of Done

MVP selesai jika:

- [x] Laptop dapat membuat room dan menampilkan QR.
- [x] Dua controller dapat bergabung sebagai pemain berbeda; uji dua HP fisik masih diperlukan.
- [x] Gyroscope dapat menggerakkan crosshair.
- [x] Touch fallback tersedia.
- [ ] **BLOCKED: physical QA** — trigger memiliki latency nyaman pada dua HP fisik.
- [x] Webcam tampil di belakang game.
- [x] Target merah, biru, dan combo berfungsi.
- [x] Score, health, timer, dan game-over berjalan.
- [x] Recenter dan reconnect controller berbasis token tersedia.
- [x] Game telah di-deploy ke URL HTTPS publik.
- [ ] **BLOCKED: physical QA** — satu ronde divalidasi end-to-end dengan laptop dan dua HP fisik memakai `docs/DEVICE_QA.md`.

## 10. Status Implementasi per Fase

### Fase 0 - Validasi Teknis: Parsial

- [x] Room, QR, aim, trigger, dan dua slot pemain diimplementasikan.
- [ ] **BLOCKED: physical QA** — uji dua HP fisik secara bersamaan.
- [ ] **BLOCKED: physical QA** — ukur latency dan kestabilan minimal 5 menit.

### Fase 1 - Fondasi Proyek: Selesai

- [x] Monorepo npm workspaces dan TypeScript.
- [x] React/Vite client, Express/Socket.IO server, dan shared protocol.
- [x] Routing, room lifecycle, token reconnect controller, environment config, dan cleanup.

### Fase 2 - Controller HP: Selesai secara Implementasi

- [x] Permission sensor Android/iOS dan `DeviceOrientationEvent`.
- [x] Mapping orientasi, throttle input, recenter, trigger, vibration, status, dan touchpad fallback.
- [x] Motion onboarding dengan secure-context/permission diagnostics, auto-calibration, live beta/gamma, dan radar aim lokal.
- [x] Sensor listener memakai auth refs terbaru sehingga Enable Motion sebelum/ketika reconnect tetap mengirim aim valid.
- [x] Telemetry RTT controller dengan badge kualitas link GOOD/FAIR/POOR untuk playtest latency.
- [ ] **BLOCKED: physical QA** — tuning dead zone, smoothing, serta drift dari hasil runbook.

### Fase 3 - Display Laptop: Selesai untuk MVP

- [x] Webcam, overlay fullscreen, QR, room code, crosshair, status pemain, start, pause, dan restart.
- [x] Close room manual pada protocol/server dan reconnect display setelah refresh.
- [x] Automatic display/controller rejoin setelah Socket.IO reconnect serta offline watchdog UI.
- [x] Routing React reaktif tanpa refresh dan single-owner join lifecycle yang aman dari duplicate effect.
- [x] Auto-pause ketika controller terputus dan resume hanya setelah kedua pemain kembali.
- [x] Error recovery inti: reconnect otomatis, offline watchdog, auto-pause, dan safe resume.
- [x] Runtime validation untuk room, auth, player, aim, shoot, reload, dan tutorial payload.

### Fase 4 - Core Gameplay: Selesai untuk MVP

- [x] Target merah, biru, combo, spawn acak, dan difficulty scaling sederhana.
- [x] Server-authoritative hit detection, rate limit, score, shield, timer, countdown, dan game-over.
- [x] Outcome authoritative victory/defeat dengan debrief dan audio berbeda.
- [x] Tiga wave terstruktur dengan target weighting dan lifetime yang makin intens.
- [x] Combo window maksimal 1 detik divalidasi server.

### Fase 5 - Game Feel: Selesai untuk MVP

- [x] Identitas visual, animasi target, scanline, flash, countdown, hasil akhir, dan vibration.
- [x] Audio sintetis untuk hit, miss, combo, warning, countdown, start, dan finish serta kontrol mute.
- [x] Musik latar ambient prosedural opsional, mengikuti fase game dan mute.
- [x] Projectile trail, impact marker, dan graded camera shake berdasarkan hasil tembakan.
- [x] Tutorial interaktif empat langkah yang tersinkron ke display dan controller.
- [x] Ammo enam cell dan manual reload yang divalidasi server.
- [x] Gesture shake untuk reload dengan acceleration threshold dan cooldown; tuning akhir menunggu playtest perangkat nyata.

### Fase 6 - QA dan Deployment: Parsial

- [x] Typecheck dan production build client/server berhasil.
- [x] Dockerfile, Render blueprint, README, dan health endpoint tersedia.
- [x] Readiness endpoint dan graceful SIGTERM/SIGINT shutdown dengan room timer cleanup.
- [x] Unit test game logic dan integration test lifecycle Socket.IO.
- [x] Browser smoke test Home → Display tanpa refresh dan Controller → Player 01 join.
- [x] Playwright E2E: Home → Display, dua controller terisolasi P1/P2, start game, dan touch aim → crosshair laptop.
- [x] GitHub Actions CI menjalankan typecheck, unit/integration, Playwright E2E, dan build pada push/PR.
- [ ] **BLOCKED: physical QA** — matriks Chrome Android, Safari iOS, browser laptop, orientasi, dan rasio layar.
- [x] Structured JSON lifecycle logging dengan redaction data sensitif.
- [x] Backend Socket.IO HTTPS di Render dan frontend HTTPS di Vercel.
- [x] Smoke test production: room, CORS, Socket.IO, dan motion secure-context berjalan.

## 11. Backlog Prioritas

### P0 - Validasi Perangkat Nyata

1. Jalankan aplikasi melalui HTTPS.
2. Hubungkan dua HP fisik melalui QR.
3. Uji sensor, recenter, fallback, vibration, dan reconnect.
4. Catat latency, jitter, drift, disconnect, serta perbedaan Android/iOS.
5. Perbaiki blocker sampai satu ronde selesai tanpa refresh.

### P1 - Reliability dan Tests

1. [x] Test deterministik countdown, timer victory, breach defeat, dan timer cleanup.
2. [x] End-to-end test browser untuk display dan dua controller.
3. [x] Test cleanup TTL, disconnect, token reclaim, dan safe resume.
4. [x] Validasi payload serta test state integrity untuk event malformed.
5. [x] Structured JSON logging dengan redaction token dan data sensor.

### P2 - Polish

1. [x] Musik latar ambient opsional.
2. [x] Projectile trail, hit feedback, dan camera shake.
3. [x] Tutorial interaktif tersinkron dengan panduan sesuai peran pemain.
4. [x] Statistik hasil akhir per pemain: shots, hits, misses, accuracy, dan combo.
5. **BLOCKED: physical QA** — tuning difficulty berdasarkan hasil satu ronde nyata.

### P3 - Deployment dan AR Lanjutan

1. [x] Deploy server dan client melalui HTTPS.
2. [x] Konfigurasikan CORS, environment production, telemetry RTT, CI, dan smoke test otomatis.
3. Post-MVP opsional: Phaser jika scene makin kompleks.
4. Post-MVP opsional: Three.js atau MindAR setelah physical QA gameplay 2D lulus.

## 12. Verifikasi Terakhir

Pipeline berikut sudah dijalankan dan lulus:

```bash
npm run typecheck
npm run test
npm run build
```

Verifikasi terakhir: **20 unit/integration test dalam 3 test file, 1 Playwright E2E, dan production smoke Render lulus**, diikuti typecheck seluruh workspace dan production build client/server.

GitHub Actions Linux run `29221368435` selesai dengan status **success**. Backend Render `/ready` sehat dan frontend Vercel melayani deep route SPA dengan HTTPS.

Test otomatis mencakup scoring, kepemilikan target, combo window, statistik, wave, outcome victory/defeat, pause expiry, alokasi pemain, room penuh, reconnect display, close room, ammo/reload, malformed payload, disconnect/reclaim/resume, readiness, structured-log redaction, cleanup TTL, dua controller terisolasi, start game, serta touch aim ke crosshair laptop. QA sensor pada perangkat fisik masih harus dilakukan.

## 13. Next Milestone

Implementasi MVP software sudah feature-complete. Urutan kerja berikutnya:

1. [x] Deploy ke HTTPS publik.
2. Jalankan smoke test lengkap laptop + dua HP fisik selama satu ronde.
3. Catat latency, sensor drift, false-trigger shake, reconnect time, dan perbedaan Android/iOS.
4. Tuning threshold, smoothing, dan difficulty hanya berdasarkan hasil playtest.
5. Setelah gameplay tervalidasi, pertimbangkan AR 3D atau marker tracking sebagai fase pasca-MVP.

## 14. Milestone Closure

Semua milestone yang dapat diselesaikan melalui implementasi, automated tests, CI, deployment, dan remote production smoke telah selesai. Sisa checkbox sengaja berstatus **BLOCKED: physical QA**, bukan pekerjaan software yang tertunda:

- Dua HP fisik dipakai bersamaan selama satu ronde.
- Latency trigger dinilai nyaman pada kedua perangkat.
- Stabilitas minimal lima menit diukur.
- Drift/dead-zone/smoothing dituning dari pengukuran nyata.
- Matriks Android Chrome dan iOS Safari dijalankan.
- Difficulty dituning berdasarkan hasil ronde nyata.

Gunakan `docs/DEVICE_QA.md`. Setelah hasil template diisi, hanya tuning berbasis data yang boleh mengubah konstanta motion/gameplay. Phaser, Three.js, dan MindAR adalah roadmap post-MVP opsional dan bukan blocker closure MVP.

---

Dokumen ini adalah living plan dan perlu diperbarui setelah pengujian perangkat atau deployment berikutnya.
