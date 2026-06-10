# KodeView

KodeView is a focused mobile code reader for public GitHub repositories. Paste a repo link, download the ZIP, and browse the source code locally — no sign-in, no Git, no internet connection after the first download.

The app is intentionally read-only. It is built for reading code, checking examples, learning from repositories, and keeping useful projects available offline.

---

## Highlights

- Download public GitHub repositories via GitHub's public API and ZIP links
- Extract repositories into local app storage
- Browse files with a clean mobile file explorer
- Open readable files in a full-screen code viewer
- Lightweight syntax highlighting for common languages
- System, light, and dark theme support
- Offline cache stats in Settings
- No login, no private repo access, no commits, no pushes, no branches, no editing

---

## Getting Started

Install dependencies:

```bash
npm install
```

Start the Expo dev server:

```bash
npx expo start
```

Open the app in Expo Go or a native build for the real offline storage flow. The web preview is useful for layout checks, but mobile storage is the main target.

---

## Scripts

```bash
npm run start
npm run android
npm run ios
npm run web
npm run lint
```

Type-check:

```bash
npx tsc --noEmit
```

---

## Expo Build Checklist

Before building on expo.dev or EAS, run:

```bash
npm install
npm ci --dry-run
npm run lint
npx tsc --noEmit
```

Expo cloud builds use `npm ci`, which is strict — `package.json` and `package-lock.json` must match exactly. A mismatch will fail the build before the app even compiles.

Good habits:

- Use `npm` consistently for this project
- Use `npx expo install <package>` for Expo packages
- Use `npm install <package>` for plain JavaScript packages
- Commit `package.json` and `package-lock.json` together after any dependency change
- Run `npm ci --dry-run` before every cloud build

---

## EAS Build

This project includes an `eas.json` with `development`, `preview`, and `production` profiles.

**Android:**

```bash
npx eas-cli@latest build -p android --profile production
```

**iOS:**

```bash
npx eas-cli@latest build -p ios --profile production
```

**Both platforms:**

```bash
npx eas-cli@latest build --profile production
```

---

## Project Structure

```
app/           Expo Router screens and tab layout
components/    App UI components and code viewer
hooks/         Theme preference and platform hooks
lib/           GitHub parsing, palette, and repository storage logic
assets/        App icons and static images
```

---

## Product Direction

KodeView should stay simple: public repositories, offline reading, and a polished code-viewing experience. It is not meant to become a Git client or editor.

---

## Privacy

KodeView does not collect personal data, use analytics, or include advertising SDKs. The app communicates only with GitHub's public API on your behalf.

Full details: [Privacy Policy](https://swaznil.github.io/KodeView/privacy-policy.html)