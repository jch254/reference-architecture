React Native mobile app, bootstrapped using [`@react-native-community/cli`](https://github.com/react-native-community/cli).

# Prerequisites

- [Node.js](https://nodejs.org/) and [pnpm](https://pnpm.io/)
- **iOS**: follow the [React Native environment setup guide](https://reactnative.dev/docs/set-up-your-environment?platform=ios)
- **Android**: follow the [React Native environment setup guide](https://reactnative.dev/docs/set-up-your-environment?platform=android)

# Running locally

## Step 0: Start the backend

The app connects to the backend API at `http://localhost:3000` in development. It must be running before you can sign in or load any data.

From the repo root:

```sh
docker-compose up
```

Or without Docker:

```sh
# from repo root
pnpm --filter backend start:dev
```

Verify it is up:

```sh
curl http://localhost:3000/api/health
```

> **Android emulator:** `localhost` refers to the emulator itself, not your machine. Use `http://10.0.2.2:3000` to reach the backend running locally.

## Step 1: Install JS and Ruby dependencies

> **Important:** `bundle install` must use the rbenv-managed Ruby, not the macOS system Ruby. If you get a `Could not find 'bundler'` error, rbenv is not initialised in your current shell — run `eval "$(rbenv init -)"` first, or add it to your `~/.zshrc`.

```sh
pnpm install
bundle install
cd ios && bundle exec pod install && cd ..
```

> Re-run `bundle exec pod install` any time native dependencies change.

## Step 2: Start Metro

```sh
pnpm start
```

## Step 3: Run on a simulator or device

Open a second terminal and run:

### iOS

```sh
pnpm ios
# or target a specific simulator:
pnpm ios --simulator "iPhone 17"
```

### Android

```sh
pnpm android
```

## Fast Refresh (hot reload)

[Fast Refresh](https://reactnative.dev/docs/fast-refresh) is enabled by default. Saving any file updates the running app instantly without losing state.

To force a full reload:

- **iOS Simulator**: Press <kbd>R</kbd>
- **Android Emulator**: Press <kbd>R</kbd> twice, or open the Dev Menu with <kbd>Cmd ⌘</kbd> + <kbd>M</kbd> (macOS)

# Troubleshooting

- _"active developer directory is a command line tools instance"_ — run `sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer`.
- _"iOS devices or simulators not detected"_ — the iOS simulator runtime has not been downloaded; run `xcodebuild -downloadPlatform iOS` or install it via Xcode → Settings → Platforms.
- _"Failed to build gem native extension"_ on `bundle install` — you are using the system Ruby; install rbenv and Ruby as described in the [iOS environment setup guide](https://reactnative.dev/docs/set-up-your-environment?platform=ios).
- _`Could not find 'bundler' (2.x.x)`_ on `bundle install` — rbenv is installed but not initialised in the current shell. Run `eval "$(rbenv init -)"` or open a new terminal after adding it to your `~/.zshrc`.
- _"Network request failed"_ in the simulator — the backend is not running. Start it with `docker-compose up` from the repo root (see Step 0 above).
- Pods out of date after pulling: `cd ios && bundle exec pod install`
- _`adb: command not found`_ — Android SDK Platform-Tools are not installed or not on PATH. Re-open Android Studio and ensure setup completed.
- _"No emulators found"_ — no virtual device created. Open Android Studio → Device Manager → Create Device.
- _"Unable to locate a Java Runtime"_ — ensure `JAVA_HOME` is set correctly per the [environment setup guide](https://reactnative.dev/docs/set-up-your-environment?platform=android).
- _App installs but doesn't connect to backend_ — Android emulator uses `10.0.2.2` instead of `localhost`. See the note in Step 0 above.
- See the [React Native Troubleshooting](https://reactnative.dev/docs/troubleshooting) page for further help.
