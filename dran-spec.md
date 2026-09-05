# Dran — Spezifikation

Familien-Kanban als PWA. Ein Board, feste Spalten, zentrale Datenhaltung auf PocketBase.

**Status:** Entwurf v1 · Grundlage für Implementierung, noch kein Code.

---

## 1. Ziel und Rahmen

Ein gemeinsames Board für den Haushalt. Wer trägt den Müll raus, wer holt das Paket, was muss vor Sonntag erledigt sein. Zielgruppe sind Familienmitglieder mit sehr unterschiedlicher Technikaffinität — die App muss ohne Erklärung bedienbar sein.

**Leitprinzipien**

1. **Eine Karte anzulegen darf höchstens drei Sekunden dauern.** Titel eintippen, fertig. Alles andere ist optional.
2. **Keine Verwaltung im laufenden Betrieb.** Accounts werden einmalig angelegt. Es gibt keine Rollen, keine Rechte, keine Einstellungen.
3. **Der Server ist die Wahrheit.** Der Client ist Cache. Kein verteilter Zustand, den irgendjemand zusammenführen muss.

**Explizit nicht im Scope (v1)**

Mehrere Boards · Rollen und Rechte · Kommentare · Checklisten innerhalb einer Karte · Dateianhänge · Markdown-Rendering · Wiederkehrende Karten · Mehrsprachigkeit · Aktivitätsverlauf.

---

## 2. Name

**Dran.**

Kurz, deutsch, und es beschreibt exakt die Semantik der Zuweisung: *„Du bist dran."* Funktioniert als Wortmarke, als Homescreen-Label unter dem Icon (fünf Zeichen, wird nie abgeschnitten) und als Subdomain.

Alternativen, falls Dran nicht trägt: **Kladde** (schön altmodisch, aber semantisch eher Notizbuch als Zuweisung) · **Ämtli** (schweizerdeutsch für Haushaltspflichten, charmant, aber regional) · **Küchentafel** (beschreibt das physische Vorbild, ist aber lang und etwas bieder).

---

## 3. Spalten

Fest, nicht konfigurierbar, keine Migration nötig:

| Key | Label | Bedeutung |
|---|---|---|
| `offen` | Offen | Steht an, niemand hat angefangen |
| `dran` | Dran | Jemand kümmert sich gerade darum |
| `fertig` | Fertig | Erledigt |

Die mittlere Spalte heißt wie die App. Das ist beabsichtigt, kann aber verwirren. Falls es stört, ist die Alternativgarnitur **Offen · Läuft · Fertig** — sie ändert nur Labels, keine Keys.

**Konsequenz aus festen Spalten:** Die Spalte ist ein `select`-Feld auf der Karte, keine eigene Collection. Kein Sortier-, Umbenenn- oder Löschverhalten muss modelliert werden.

---

## 4. Datenmodell (PocketBase)

### 4.1 `users` (System-Collection)

Bleibt unverändert. Accounts werden ausschließlich über die Admin-UI angelegt. Registrierung ist deaktiviert.

### 4.2 `members`

Wer auf Karten zugewiesen werden kann.

| Feld | Typ | Constraints |
|---|---|---|
| `id` | auto | |
| `name` | text | required, max 24 |
| `color` | select | required, feste Palette (s.u.) |
| `emoji` | text | optional, max 4 — Avatar-Darstellung |
| `user` | relation → `users` | optional, single |
| `active` | bool | default `true` |

**Warum `members` getrennt von `users`:** Nicht jede zuweisbare Person braucht einen Login (Oma, das kleine Kind, „Alle"). Und ein gelöschter Account soll keine Karten verwaisen lassen.

**Warum `active` statt Löschen:** Ausgeschiedene Mitglieder verschwinden aus dem Zuweisungs-Picker, bleiben aber auf alten Karten korrekt gerendert.

**Farbpalette:** acht feste Werte, kontraststark gegen hellen und dunklen Hintergrund. Zuweisung bei Anlage, danach unveränderlich — sonst „welcher ist nochmal Lisa".

### 4.3 `cards`

| Feld | Typ | Constraints |
|---|---|---|
| `id` | auto | |
| `title` | text | required, max 120 |
| `notes` | text | optional, max 2000, Plaintext |
| `list` | select | required, `offen` \| `dran` \| `fertig`, default `offen` |
| `pos` | text | required, Fractional Index (§5) |
| `assignees` | relation → `members` | optional, **multiple**, maxSelect 8 |
| `due` | date | optional, Tagesgenauigkeit |
| `doneAt` | date | optional, gesetzt beim Wechsel nach `fertig` |
| `archived` | bool | default `false` |
| `created` / `updated` | auto | PocketBase-Systemfelder |

**Abweichung vom Vorgespräch:** Ich hatte `assignees` als JSON-Array vorgeschlagen. Multi-Relation ist besser — sie ist über `assignees ?= "<id>"` serverseitig filterbar, `expand` liefert Namen und Farben in einem Request mit, und referenzielle Integrität kommt gratis. Kein Grund für JSON.

**Zu `due`:** Nur Datum, keine Uhrzeit. Uhrzeitgenaue Fälligkeiten in einem Familienhaushalt erzeugen Präzision, die niemand pflegt, und ziehen sofort Zeitzonen- und Erinnerungslogik nach sich.

### 4.4 API Rules

Alle Collections, alle Operationen (`list`, `view`, `create`, `update`, `delete`):

```
@request.auth.id != ""
```

Ausnahme `members`: `create`/`update`/`delete` bleiben leer (= nur Admin über die UI). Wer eingeloggt ist, ist Familie und darf alles. Jede feinere Regel wäre Verwaltung, die wir nicht wollen.

---

## 5. Sortierung: Fractional Indexing

`pos` ist ein String, lexikografisch sortiert. Bibliothek: `fractional-indexing` (npm).

- Neue Karte oben in einer Spalte: `generateKeyBetween(null, firstPos)`
- Verschieben zwischen zwei Karten: `generateKeyBetween(prevPos, nextPos)`
- Sortierung im Client: `pos` aufsteigend, Sekundärschlüssel `id`

**Warum:** Beim Verschieben einer Karte wird genau ein Feld einer Karte geschrieben. Kein Neuvergeben aller Positionen, keine Schreib-Lawine über SSE an alle Clients.

**Bekannte Grenzen, bewusst akzeptiert:**

- Zwei Clients können gleichzeitig denselben Key erzeugen. Die Sekundärsortierung nach `id` macht das Ergebnis deterministisch, nur eventuell nicht so, wie beide es erwartet hätten. Bei einem Familienboard vernachlässigbar.
- Nach sehr vielen Einfügungen an derselben Stelle wachsen die Keys. Ein Rebalance-Skript (alle Karten einer Spalte neu durchnummerieren) gehört als Admin-Kommando ins Backend, wird aber realistisch nie gebraucht.

---

## 6. Interaktionsmodell

### 6.1 Layout

**Mobil (Primärziel):** Eine Spalte füllt den Bildschirm. Oben eine Segmented Control mit den drei Spaltennamen und den jeweiligen Kartenzahlen. Spaltenwechsel **nur** über diese Control.

> **Warum kein horizontales Swipen der Spaltenfläche:** Das kollidiert direkt mit dem Wisch-Gesture auf der Karte (§6.3). Zwei horizontale Gesten übereinander sind auf Touch unzuverlässig zu trennen. Die Segmented Control gewinnt, weil sie zusätzlich immer sichtbar macht, wie viel wo liegt.

**Desktop:** Drei Spalten nebeneinander, Drag & Drop zusätzlich verfügbar.

### 6.2 Karte anlegen

Persistenter „+"-Button unten rechts. Öffnet ein einzeiliges Eingabefeld mit Fokus und offener Tastatur. Enter legt an und lässt das Feld offen für die nächste Karte. Alles Weitere (Zuweisung, Notiz, Fälligkeit) wird über die Kartendetails nachgetragen.

Die Karte landet in der aktuell sichtbaren Spalte, oben.

### 6.3 Karte verschieben

Drei Wege, in dieser Priorität:

1. **Wisch auf der Karte.** Nach rechts: eine Spalte weiter (`offen` → `dran` → `fertig`). Nach links: zurück. Deckt den mit Abstand häufigsten Fall ab und ist eine Geste ohne Menü.
2. **Detailansicht.** Drei Buttons „Nach Offen / Dran / Fertig".
3. **Drag & Drop.** Nur Desktop, Pointer Events.

Der Wechsel nach `fertig` setzt `doneAt` auf heute. Der Wechsel weg von `fertig` löscht es wieder.

### 6.4 Zuweisung

In der Detailansicht eine Reihe von Avataren (Emoji auf Mitgliedsfarbe). Antippen togglet. Kein Dropdown, kein Suchfeld — bei sechs Mitgliedern ist eine Liste zum Antippen schneller als jedes Widget.

Auf der Karte im Board erscheinen die Zugewiesenen als kleine Farbpunkte mit Emoji, rechts oben.

### 6.5 Filter

Über der Spaltenauswahl eine Avatarleiste aller aktiven Mitglieder. Ein Avatar angetippt = nur Karten dieser Person, über alle Spalten. Nochmal antippen = Filter aus. Der Zustand ist rein lokal und überlebt keinen Neuladen — ein vergessener Filter, der ein leeres Board zeigt, ist der klassische Supportanruf.

### 6.6 Umgang mit der Fertig-Spalte

Ohne Gegenmaßnahme ist `fertig` nach drei Monaten eine Halde und die App fühlt sich langsam an.

- **Client:** Zeigt nur Karten mit `doneAt` innerhalb der letzten 14 Tage. Darunter eine Zeile „37 ältere anzeigen".
- **Server:** PocketBase-Hook (`cronAdd`, täglich nachts) setzt `archived = true` bei `doneAt` älter als 30 Tage. Archivierte Karten werden nie geladen.
- Gelöscht wird nie automatisch.

---

## 7. Synchronisation

### 7.1 Online

Beim Start: ein Request `GET /api/collections/cards/records?filter=(archived=false)&expand=assignees&perPage=500`, plus `members`.

Danach: PocketBase Realtime-Subscription (SSE) auf `cards` und `members`. Eingehende `create`/`update`/`delete`-Events werden in den lokalen Store gemergt. Kein Polling.

Schreibvorgänge gehen als `PATCH` mit **nur den geänderten Feldern** raus. Das Echo-Event der eigenen Änderung kommt über SSE zurück und wird anhand einer lokalen Op-ID unterdrückt, damit die UI nicht flackert.

### 7.2 Konfliktstrategie

**Last-Write-Wins pro Feld.** Kein CRDT, keine Versionsvektoren.

Der Effekt: Wenn zwei Leute gleichzeitig dieselbe Karte anfassen, gewinnt pro Feld der spätere Schreibvorgang. Ändert A den Titel und B die Zuweisung, bleiben beide Änderungen erhalten, weil sich die PATCHes nicht überlappen. Für ein Board mit fünf Personen ist das die richtige Komplexitätsstufe.

### 7.3 Offline

Service Worker cached die App-Shell (Precache, `vite-plugin-pwa`). Kartenstand liegt in IndexedDB.

Mutationen im Offline-Zustand gehen in eine persistente Queue:

```
{ opId, kind: 'create'|'update'|'delete', cardId, patch, ts }
```

Bei Reconnect wird die Queue in Reihenfolge abgespielt. Fehlerfälle:

| Fall | Verhalten |
|---|---|
| Karte serverseitig gelöscht | Op verwerfen, einmalige Toast-Meldung |
| 4xx (Validierung) | Op verwerfen, Toast |
| 5xx / Netzwerk | Op bleibt in Queue, erneuter Versuch |

**Zwei Risiken, die ich hier explizit stehen lasse:**

- **Temporäre IDs.** Offline erzeugte Karten bekommen eine lokale ID. Nach dem Sync vergibt der Server eine neue. Alle lokalen Referenzen (Filter, geöffnete Detailansicht, weitere Ops in der Queue auf dieselbe Karte) müssen umgebogen werden. Das ist die fehleranfälligste Stelle des ganzen Entwurfs und braucht Tests.
- **Positionen nach Offline-Verschiebung.** Ein `pos`, der offline gegen einen inzwischen veralteten Nachbarn berechnet wurde, landet beim Replay möglicherweise an unerwarteter Stelle. Bewusst akzeptiert: Reihenfolge innerhalb einer Spalte ist unkritisch, die Spaltenzugehörigkeit ist es nicht — und die bleibt korrekt.

---

## 8. Frontend

**Svelte 5 + Vite + `vite-plugin-pwa`**, TypeScript, kein UI-Framework.

Build-Output landet in `pb_public/` und wird von PocketBase selbst ausgeliefert. Gleiche Origin, also kein CORS, kein zweiter Prozess.

**Struktur**

```
src/
  lib/
    pb.ts           PocketBase-Client, Auth, Realtime-Subscriptions
    store.ts        Reaktiver Kartenstore, Merge-Logik
    queue.ts        Offline-Queue über IndexedDB
    pos.ts          Fractional-Index-Helfer
  routes/
    Board.svelte    Spaltenansicht
    Card.svelte     Detail-Sheet
    Login.svelte
```

**PWA-Manifest**

`display: standalone`, `orientation: portrait`, Theme-Farbe passend zum hellen und dunklen Modus, Icons in 192 und 512 px plus eine `maskable`-Variante, dazu `apple-touch-icon` für iOS.

**Auth:** Token im `localStorage`, sehr lange Gültigkeit. Niemand soll sich in einer Familien-App regelmäßig neu anmelden. Kein Logout-Button prominent im UI.

---

## 9. Deployment

Ein Docker-Container auf der Unraid.

```
/mnt/user/appdata/dran/
  pb_data/       SQLite, Uploads, Backups
  pb_public/     gebautes Frontend
  pb_hooks/      Cron für Archivierung
```

**Reverse Proxy:** Caddy (oder SWAG, falls schon vorhanden) terminiert TLS mit Let's Encrypt und leitet auf den PocketBase-Port. Portfreigabe 443 in der Fritzbox 4060.

**DynDNS wird gebraucht.** Der Telekom-Anschluss hat eine echte IPv4, aber keine feste — die Fritzbox kann DynDNS selbst aktualisieren, das muss vor dem ersten ACME-Lauf stehen.

**Backup:** PocketBase-Auto-Backup täglich (ZIP-Snapshot in `pb_data/backups/`), zusätzlich das Appdata-Share über den Unraid-Backup-Plugin. Die gesamte App ist damit eine Datei plus ein Verzeichnis.

**Verfügbarkeitsrisiko, unverändert aus dem Vorgespräch:** Bei DSL-Ausfall oder Unraid-Wartung steht die Familie vor einer toten App und du bist der Support. Der Umzug auf einen kleinen VPS ist jederzeit möglich — `pb_data/` kopieren, Container starten, DNS umbiegen. Kein Grund, jetzt schon dorthin zu gehen.

---

## 10. Phase 2

- **Web Push für Fälligkeiten.** Funktioniert auf iOS ab 16.4 nur bei zum Homescreen hinzugefügter PWA. Braucht VAPID-Schlüssel und einen serverseitigen Cron, der morgens prüft. Bewusst nicht in v1.
- **Wiederkehrende Karten.** Müll, Wäsche, Blumen. Charmant, aber es zieht ein Regelwerk nach sich (Intervall, nächste Fälligkeit, was passiert bei „fertig") und gehört erst rein, wenn v1 im Alltag steht.
- **Foto an der Karte.** PocketBase kann File-Uploads mit Thumbnails. Zieht Speicherverwaltung nach sich.

---

## 11. Offene Punkte

1. **Spaltenlabels:** `Offen · Dran · Fertig` oder `Offen · Läuft · Fertig` (§3)?
2. **Mitgliederzahl und Namen** für die Erstbefüllung der Palette.
3. **Fälligkeitsdatum in v1?** Es ist das erste Feld, das ohne Erinnerungsfunktion halb nutzlos wirkt. Denkbar, es zusammen mit Push in Phase 2 zu schieben und v1 wirklich auf Titel, Spalte, Zuweisung zu reduzieren.
4. **Domain/Subdomain** für das Zertifikat.
