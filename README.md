# KodeView

I built KodeView for the moments when I want to read through a GitHub project without pulling out a laptop or setting up a development environment. Paste a public repository link, let the app download it once, and the code stays available on your phone for offline reading.

KodeView is deliberately a reader, not a pocket-sized Git client. It does not edit files, create commits, or ask for a GitHub login. The goal is a fast, calm place to explore source code.

## What it can do

- Download any public GitHub repository from a URL
- Keep the last working copy safe if an update is interrupted
- Browse large folder trees with search and expand/collapse controls
- Read source files with syntax highlighting
- Select, copy, share, and search within code
- Open links from Markdown files
- Store an optional GitHub API token securely in the Android Keystore or iOS Keychain
- Follow your system theme, or stay in light or dark mode
- Show local storage usage and work offline after a repository is downloaded

Public repositories reported by GitHub as larger than 300 MB are not imported. Large projects can take time and require considerably more free space while they are extracted.

## Run it locally

KodeView uses Expo SDK 54 and Node's npm package manager.

```bash
npm install
npx expo start
```

Expo Go is handy for development, while a native build gives the most accurate picture of the offline storage experience.

Before opening a pull request or making a release, run:

```bash
npm run validate
```

That command runs ESLint, TypeScript, and Expo Doctor.

## Android builds

The EAS profiles are already included in `eas.json`.

```bash
# Installable APK
npx eas-cli@latest build --platform android --profile apk

# Play Store AAB
npx eas-cli@latest build --platform android --profile production
```

The production profile manages the Android version code remotely and increments it for each store build.

## Project layout

```text
app/           Screens and Expo Router routes
components/    Reusable interface and code-reading components
hooks/         Theme and platform hooks
lib/           GitHub requests, secure settings, and repository storage
assets/        Icons and other bundled artwork
```

## Privacy

KodeView has no ads or analytics and does not collect personal information. Network requests go to GitHub only when you ask the app to fetch repository data. An optional API token never leaves secure device storage except when it is sent directly to GitHub as part of those requests.

Read the full [privacy policy](https://swaznil.github.io/KodeView/privacy-policy.html).

## License and contributions

Issues and thoughtful pull requests are welcome. If you find a repository that KodeView struggles to display, please include the public repository URL and the device you tested on so the problem is easier to reproduce.
