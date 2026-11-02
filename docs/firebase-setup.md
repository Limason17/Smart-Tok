# Firebase einrichten (Konto und Sync)

Smart-Tok speichert Konten und Sync-Daten in einem kostenlosen Firebase-Projekt (Tarif „Spark“, keine Kreditkarte). Das Projekt gehört deinem Google-Konto. Dauer: etwa 10 Minuten am Computer.

## 1. Projekt anlegen
1. Öffne <https://console.firebase.google.com> und melde dich mit deinem Google-Konto an.
2. **Projekt erstellen** → Name `smart-tok` → Google Analytics **ausschalten** → Erstellen.

## 2. Anmeldung mit E-Mail einschalten
1. Links **Build → Authentication** → **Jetzt starten**.
2. Reiter **Sign-in method** → **E-Mail/Passwort** → nur den ersten Schalter aktivieren → Speichern.
3. Reiter **Einstellungen → Autorisierte Domains** → **Domain hinzufügen** → `limason17.github.io`.
4. Optional: Reiter **Vorlagen** → Stift-Symbol → Sprache **Deutsch**, damit die Mail zum Zurücksetzen des Passworts deutsch ist.

## 3. Datenbank anlegen
1. Links **Build → Firestore Database** → **Datenbank erstellen**.
2. Edition Standard, Standort **eur3 (Europa)** → **Im Produktionsmodus starten** → Erstellen.
3. Reiter **Regeln**: alles löschen, den Inhalt von [`firestore.rules`](../firestore.rules) einfügen → **Veröffentlichen**.

Diese Regeln sorgen dafür, dass jedes Konto nur seine eigenen Daten lesen und ändern kann.

## 4. Web-App registrieren
1. Zahnrad oben links → **Projekteinstellungen** → unten bei „Meine Apps“ das Symbol **`</>`** (Web).
2. Name `Smart-Tok`, Hosting **nicht** ankreuzen → **App registrieren**.
3. Firebase zeigt einen Block `const firebaseConfig = { apiKey: …, authDomain: …, projectId: …, … }`.
   Diesen Block in `src/sync/config.ts` bei `PROJECT_CONFIG` eintragen.

Die Werte darin sind kein Geheimnis: Jede Web-App liefert sie an den Browser aus. Geschützt werden die Daten durch die Regeln aus Schritt 3.

## Was gespeichert wird
Pro Konto genau ein Dokument `users/{uid}` mit Benutzername, Verlauf (welche Karte wann gelesen, Like, Speichern), Tageszählern, Themen-Einstellungen, Algorithmus-Werten und Themenvorschlägen. Passwörter verwaltet Firebase selbst; Smart-Tok sieht sie nie.

## Kostenlos bleiben
Der Spark-Tarif erlaubt pro Tag 50 000 Lesezugriffe und 20 000 Schreibzugriffe. Smart-Tok braucht pro Person und Tag grob 10 Lese- und 100 Schreibzugriffe, für dich und Freunde reicht das weit.
