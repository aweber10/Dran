# Dran

Dran ist ein kleines Familien-Kanban als installierbare PWA. Es hat genau ein Board mit den Spalten **Offen**, **Dran** und **Fertig**. PocketBase liefert Anmeldung, Datenhaltung und Realtime-Synchronisation; der Browser hält einen Offline-Cache und eine persistente Änderungsqueue.

Die Produktbeschreibung liegt in [dran-spec.md](dran-spec.md), die ursprüngliche klickbare Attrappe in [dran-mockup.html](dran-mockup.html).

## Lokale Entwicklung

Voraussetzungen: Node.js 20+, npm und optional Docker.

```sh
npm install
npm run dev
```

Vite läuft auf Port 5173 und leitet `/api` sowie `/_/` an PocketBase auf `127.0.0.1:8090` weiter. Das Backend lässt sich vollständig über Docker starten:

```sh
docker compose up --build
```

Alternativ kann eine PocketBase-0.40.2-Binary im Projektverzeichnis verwendet werden:

```sh
./pocketbase serve --dir=pb_data --publicDir=pb_public --hooksDir=pb_hooks --migrationsDir=pb_migrations
```

Beim ersten Start erzeugt PocketBase einen Link für den ersten Superuser. Danach unter `http://127.0.0.1:8090/_/`:

1. In `users` für jedes Familienmitglied mit Login einen Datensatz mit E-Mail und Passwort anlegen.
2. In `members` alle zuweisbaren Personen anlegen. `user` darf leer bleiben; `active` muss für den Picker aktiv sein.
3. Die Farbe sorgfältig wählen: Sie ist nach dem Anlegen absichtlich unveränderlich.

Es gibt keine öffentliche Registrierung und keine Seed-Daten.

## Qualität

```sh
npm run check
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Der Produktionsbuild landet in `pb_public/`. Der Service Worker cached ausschließlich die App-Shell; Boarddaten und ausstehende Änderungen liegen in IndexedDB.

## Betrieb auf Unraid

Empfohlene `.env` neben `compose.yaml`:

```dotenv
TZ=Europe/Berlin
DRAN_DATA_PATH=/mnt/user/appdata/dran/pb_data
DRAN_BIND_ADDRESS=127.0.0.1
DRAN_PORT=8090
DOMAIN=dran.example.net
```

`docker compose up -d --build` startet einen einzelnen Container. Nur `pb_data` muss persistent sein; Frontend, Migrationen und Hooks sind im Image enthalten. Das Image unterstützt `linux/amd64` und `linux/arm64` und prüft die offizielle PocketBase-Release-Prüfsumme beim Build.

Die Domain wird nicht in die App gebaut. Beispiele für Caddy und SWAG/Nginx liegen unter `deploy/`. Für Realtime/SSE muss Proxy-Buffering deaktiviert sein. Der öffentliche Proxy terminiert TLS; Port 8090 bleibt intern.

### Reihenfolge für den ersten Produktivstart

1. DynDNS in der Fritzbox konfigurieren und prüfen.
2. DNS auf die öffentliche IPv4 zeigen lassen und TCP 443 zum Reverse Proxy weiterleiten.
3. Container intern starten und den Healthcheck unter `/api/health` prüfen.
4. Caddy- oder SWAG-Beispiel übernehmen, `DOMAIN` einsetzen und erst dann das Zertifikat anfordern.
5. Superuser, Login-Konten und Mitglieder über `/_/` anlegen.
6. PWA auf den Familiengeräten installieren und einmal online anmelden.

### Backups und Wiederherstellung

PocketBase erstellt täglich um 03:00 Uhr ein ZIP-Backup und behält 14 Generationen in `pb_data/backups/`. Das gesamte Unraid-Appdata-Verzeichnis sollte zusätzlich durch das Unraid-Backup-Plugin gesichert werden.

Restore-Test:

1. Container stoppen und das aktuelle `pb_data` sichern.
2. Gewünschtes ZIP über die PocketBase-Adminoberfläche wiederherstellen oder in einer separaten Testinstanz prüfen.
3. Login, Kartenzahl und Realtime-Verbindung kontrollieren.
4. Erst danach die reguläre Instanz wieder freigeben.

PocketBase ist vor Version 1.0 nicht vollständig abwärtskompatibel. Upgrades deshalb nur bewusst durchführen: Changelog lesen, `pb_data` sichern, `PB_VERSION` aktualisieren, Image neu bauen und Migrationen zuerst gegen eine Kopie testen.

## Serververhalten

- Beim Wechsel nach `fertig` setzt ein Server-Hook `doneAt`; beim Zurückverschieben wird es geleert.
- Karten älter als 30 Tage werden täglich um 02:30 Uhr archiviert, aber nie automatisch gelöscht.
- Mitgliederfarben sind unveränderlich.
- Alle Kartenoperationen erfordern einen Login. Mitglieder können angemeldete Nutzer lesen, aber nur Superuser verwalten.
- Auth-Tokens sind 365 Tage gültig. Ein Passwortwechsel beziehungsweise eine administrative Token-Invalidierung bleibt der Weg für verlorene Geräte.
