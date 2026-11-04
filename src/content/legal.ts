// Privacy notice, contact and content notes (Swiss nDSG; written to also cover the EU GDPR).
// Shown in the app under Settings → "Datenschutz & Rechtliches".
// Text conventions: blank line = new paragraph, "- " = list item, **bold**, [text](https://…) = link,
// {name} and {email} are replaced by OWNER.
import type { Lang } from './taxonomy';

/** The person responsible for the app and for the data (privacy notice, contact). */
export const OWNER = {
  name: 'Liam Bruno',
  email: 'liambruno.work@gmail.com',
};

/** Date of the last change to the texts below. */
export const LEGAL_UPDATED: Record<Lang, string> = { de: '4. November 2026', en: '4 November 2026' };

export interface LegalSection {
  h: string;
  text: string;
}

const de: LegalSection[] = [
  {
    h: 'Kurz gesagt',
    text: `- Smart-Tok ist ein privates, kostenloses Lernprojekt. Keine Werbung, kein Tracking, keine Statistik-Tools, keine Werbe-Cookies.
- **Ohne Konto** bleibt alles auf deinem Gerät.
- **Mit Konto** werden deine Daten gespeichert, damit sie auf all deinen Geräten gleich sind, und ausgewertet, damit Karten und Algorithmus besser werden.
- Du kannst deine Daten jederzeit herunterladen und löschen.`,
  },
  {
    h: 'Verantwortlich und Kontakt',
    text: `Verantwortlich für die App und für die Bearbeitung deiner Daten:

**{name}**, Schweiz
E-Mail: {email}

Für Fragen zu deinen Daten, Korrekturen oder Hinweise genügt eine E-Mail.`,
  },
  {
    h: 'Ohne Konto: Daten auf deinem Gerät',
    text: `Die App merkt sich, welche Karten du gesehen, gelikt, gespeichert oder auf die Umsetzen-Liste gesetzt hast, wie lange du gelesen hast, deine Themen und Einstellungen. Das liegt im Speicher deines Browsers (IndexedDB) und wird nicht an mich gesendet. Der Algorithmus rechnet nur auf deinem Gerät.

Löschen kannst du das jederzeit unter Einstellungen → „Alles zurücksetzen“ oder indem du die Websitedaten im Browser löschst. Die App-Dateien selbst werden für die Offline-Nutzung zwischengespeichert.`,
  },
  {
    h: 'Hosting',
    text: `Die App wird über GitHub Pages ausgeliefert (GitHub Inc., USA). Beim Aufruf bearbeitet GitHub technisch nötige Daten wie deine IP-Adresse, den Zeitpunkt und den Browsertyp, um den Dienst sicher zu betreiben. Ich habe darauf keinen Zugriff. Mehr dazu: [Datenschutz von GitHub](https://docs.github.com/de/site-policy/privacy-policies/github-general-privacy-statement).

Schriften und alle übrigen Dateien kommen direkt von dieser Seite. Es werden keine fremden Dienste wie Google Fonts geladen.`,
  },
  {
    h: 'Mit Konto: was gespeichert wird',
    text: `Für Anmeldung und Speicherung nutzt die App Firebase von Google (Google Ireland Ltd. und Google LLC, USA). Gespeichert werden:

- E-Mail-Adresse und Passwort (das Passwort nur verschlüsselt bei Google, ich sehe es nie)
- dein Benutzername
- dein Verlauf: gesehene Karten, Lesedauer, Likes und Dislikes, gespeicherte Karten, Umsetzen-Liste
- deine Themen, Einstellungen, Algorithmus-Anpassungen und Vorschläge

Dein Verlauf liegt in Rechenzentren in Europa. Für die Anmeldung kann Google Daten auch in den USA bearbeiten. Google ist nach dem Swiss-U.S. und dem EU-U.S. Data Privacy Framework zertifiziert. Damit du angemeldet bleibst, legt Firebase einen Anmeldestatus in deinem Browser ab; das ist technisch nötig. Mehr dazu: [Datenschutz von Google](https://policies.google.com/privacy?hl=de).

Zweck ist, dass du deine Daten auf allen Geräten hast und nicht verlierst (in der EU: Art. 6 Abs. 1 lit. b DSGVO).`,
  },
  {
    h: 'Auswertung, damit die App besser wird',
    text: `Wie Konten die App nutzen (gesehene, gelikte und gespeicherte Karten, Lesedauer, Themen, Vorschläge), werte ich regelmässig aus. Daraus entstehen neue Karten und Ideen für einen besseren Algorithmus. Dabei hilft mir ein KI-Werkzeug eines Anbieters in den USA. Ich gebe dafür nur Benutzernamen und Nutzungsdaten weiter, nie E-Mail-Adressen. Die Ergebnisse werden weder veröffentlicht noch verkauft.

Grundlage ist mein Interesse an einer guten App (in der EU: Art. 6 Abs. 1 lit. f DSGVO). Du kannst jederzeit per E-Mail widersprechen oder die App ohne Konto nutzen.`,
  },
  {
    h: 'Wie lange',
    text: `Kontodaten bleiben gespeichert, bis du dein Konto löschst (Profil → Konto → „Konto löschen“). Dann werden dein Konto und alle Daten darin sofort gelöscht. Notizen aus Auswertungen enthalten keine E-Mail-Adressen und werden nur so lange aufbewahrt, wie sie für die Verbesserung nötig sind.`,
  },
  {
    h: 'Deine Rechte',
    text: `Du kannst Auskunft über deine Daten verlangen, sie berichtigen, löschen oder herausgeben lassen und der Auswertung widersprechen. Vieles geht direkt in der App: Einstellungen → „Daten herunterladen“ (JSON oder CSV) und Profil → Konto → „Konto löschen“. Für alles andere: E-Mail an {email}.

Beschweren kannst du dich beim [Eidgenössischen Datenschutz- und Öffentlichkeitsbeauftragten (EDÖB)](https://www.edoeb.admin.ch) oder, wenn du in der EU wohnst, bei der Datenschutzbehörde deines Landes.`,
  },
  {
    h: 'Hinweis zu den Inhalten',
    text: `Die Karten dienen der allgemeinen Bildung und Motivation. Sie sind sorgfältig geschrieben, aber ohne Gewähr für Richtigkeit, Vollständigkeit und Aktualität. Sie ersetzen keine persönliche Beratung:

- **Körper, Training, Ernährung:** keine medizinische Beratung. Sprich vor einem neuen Training oder einer Ernährungsumstellung mit einer Ärztin oder einem Arzt, besonders wenn du Beschwerden hast.
- **Geld:** keine Anlage-, Steuer- oder Rechtsberatung. Entscheide über dein Geld selbst oder mit einer Fachperson.
- **Aktuelles:** Nachrichten-Karten fassen den Stand beim Schreiben zusammen und können überholt sein.
- **Wenn es dir nicht gut geht:** hol dir Hilfe. In der Schweiz hört dir die Dargebotene Hand rund um die Uhr zu, Telefon **143**.

Die Nutzung erfolgt auf eigene Verantwortung. Eine Haftung ist ausgeschlossen, soweit das Gesetz es zulässt.`,
  },
  {
    h: 'Personen, Zitate und Marken',
    text: `Die Karten erzählen von bekannten Personen und zitieren sie kurz mit Quellenangabe. Die Texte sind eigene Zusammenfassungen. Smart-Tok steht in keiner Verbindung zu den genannten Personen, Firmen oder Werken. Dass jemand vorkommt, heisst nicht, dass er oder sie die App kennt oder unterstützt. Namen, Marken und Werktitel gehören ihren jeweiligen Inhabern.

Bibeltexte (Deutsch): Einheitsübersetzung der Heiligen Schrift, vollständig durchgesehene und überarbeitete Ausgabe, © 2016 Katholische Bibelanstalt GmbH, Stuttgart. Bibeltexte (Englisch): New American Bible, revised edition, © 2010, 1991, 1986, 1970 Confraternity of Christian Doctrine, Washington, D.C., used by permission of the copyright owner. All Rights Reserved.

Ist etwas falsch oder nicht in Ordnung? Schreib mir an {email}, ich korrigiere oder entferne es rasch.

Texte und Gestaltung der App: © 2026 {name}.`,
  },
];

const en: LegalSection[] = [
  {
    h: 'In short',
    text: `- Smart-Tok is a private, free learning project. No ads, no tracking, no analytics tools, no advertising cookies.
- **Without an account** everything stays on your device.
- **With an account** your data is stored so it is the same on all your devices, and analysed so cards and the algorithm get better.
- You can download and delete your data at any time.`,
  },
  {
    h: 'Responsible person and contact',
    text: `Responsible for the app and for processing your data:

**{name}**, Switzerland
Email: {email}

For questions about your data, corrections or hints, an email is all it takes.`,
  },
  {
    h: 'Without an account: data on your device',
    text: `The app remembers which cards you have seen, liked, saved or put on your to-do list, how long you read, your topics and settings. This lives in your browser's storage (IndexedDB) and is not sent to me. The algorithm runs only on your device.

You can delete it at any time under Settings → "Reset everything" or by clearing the site data in your browser. The app files themselves are cached for offline use.`,
  },
  {
    h: 'Hosting',
    text: `The app is served via GitHub Pages (GitHub Inc., USA). When you open it, GitHub processes technically necessary data such as your IP address, the time and your browser type to run the service securely. I have no access to it. More: [GitHub privacy statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement).

Fonts and all other files come directly from this site. No third-party services such as Google Fonts are loaded.`,
  },
  {
    h: 'With an account: what is stored',
    text: `For sign-in and storage the app uses Firebase by Google (Google Ireland Ltd. and Google LLC, USA). Stored are:

- email address and password (the password only encrypted at Google, I never see it)
- your username
- your history: cards seen, reading time, likes and dislikes, saved cards, to-do list
- your topics, settings, algorithm adjustments and suggestions

Your history is stored in data centres in Europe. For sign-in, Google may also process data in the USA. Google is certified under the Swiss-U.S. and EU-U.S. Data Privacy Framework. To keep you signed in, Firebase stores a sign-in state in your browser; this is technically necessary. More: [Google privacy policy](https://policies.google.com/privacy?hl=en).

The purpose is that you have your data on all devices and do not lose it (in the EU: Art. 6(1)(b) GDPR).`,
  },
  {
    h: 'Analysis to improve the app',
    text: `I regularly analyse how accounts use the app (cards seen, liked and saved, reading time, topics, suggestions). This leads to new cards and ideas for a better algorithm. An AI tool from a provider in the USA helps me with this. I only pass on usernames and usage data, never email addresses. The results are neither published nor sold.

The basis is my interest in a good app (in the EU: Art. 6(1)(f) GDPR). You can object at any time by email or use the app without an account.`,
  },
  {
    h: 'How long',
    text: `Account data is kept until you delete your account (Profile → Account → "Delete account"). Your account and all data in it are then deleted immediately. Notes from analyses contain no email addresses and are kept only as long as they are needed for improvements.`,
  },
  {
    h: 'Your rights',
    text: `You can ask what data is stored about you, have it corrected, deleted or handed over, and object to the analysis. Much of this works directly in the app: Settings → "Download data" (JSON or CSV) and Profile → Account → "Delete account". For everything else: email {email}.

You can complain to the [Swiss Federal Data Protection and Information Commissioner (FDPIC)](https://www.edoeb.admin.ch/en) or, if you live in the EU, to the data protection authority of your country.`,
  },
  {
    h: 'About the content',
    text: `The cards are for general education and motivation. They are written with care, but without guarantee of accuracy, completeness or timeliness. They do not replace personal advice:

- **Body, training, nutrition:** not medical advice. Talk to a doctor before starting a new training plan or changing your diet, especially if you have health problems.
- **Money:** not investment, tax or legal advice. Decide about your money yourself or with a professional.
- **News:** news cards summarise the situation at the time of writing and may be out of date.
- **If you are not doing well:** get help. In Switzerland, Die Dargebotene Hand listens around the clock on **143**; elsewhere, your local crisis line.

You use the app at your own risk. Liability is excluded as far as the law allows.`,
  },
  {
    h: 'People, quotes and trademarks',
    text: `The cards tell stories about well-known people and quote them briefly with the source. The texts are my own summaries. Smart-Tok is not affiliated with the people, companies or works mentioned. Being mentioned does not mean that someone knows or endorses the app. Names, trademarks and titles belong to their respective owners.

Bible texts (German): Einheitsübersetzung der Heiligen Schrift, vollständig durchgesehene und überarbeitete Ausgabe, © 2016 Katholische Bibelanstalt GmbH, Stuttgart. Bible texts (English): Scripture texts in this work are taken from the New American Bible, revised edition © 2010, 1991, 1986, 1970 Confraternity of Christian Doctrine, Washington, D.C. and are used by permission of the copyright owner. All Rights Reserved.

Is something wrong or not okay? Email me at {email} and I will correct or remove it quickly.

Texts and design of the app: © 2026 {name}.`,
  },
];

export const LEGAL: Record<Lang, LegalSection[]> = { de, en };
