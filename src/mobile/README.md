React Native mobile app, bootstrapped using [`@react-native-community/cli`](https://github.com/react-native-community/cli).

# Prerequisites

- [Node.js](https://nodejs.org/) and [pnpm](https://pnpm.io/)
- **iOS**: [Xcode](https://apps.apple.com/app/xcode/id497799835) (full app from the Mac App Store — Command Line Tools alone are not sufficient) and [rbenv](https://github.com/rbenv/rbenv) for Ruby management
- **Android**: [Android Studio](https://developer.android.com/studio)

## macOS: one-time iOS setup

### 1. Install Xcode and accept the license

```sh
# After installing Xcode from the Mac App Store:
sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
sudo xcodebuild -license accept
```

### 2. Download the iOS simulator runtime

Xcode 15+ no longer bundles simulator runtimes — they must be downloaded separately:

```sh
# Downloads the latest iOS simulator runtime (~5 GB)
xcodebuild -downloadPlatform iOS
```

Alternatively: open Xcode → Settings → Platforms → click the **+** button and install the iOS platform.

### 3. Install rbenv and Ruby 3.3

The system Ruby on macOS cannot compile native gems. Use rbenv instead:

```sh
brew install rbenv ruby-build
# Add to your shell profile (~/.zshrc):
echo 'eval "$(rbenv init -)"' >> ~/.zshrc && source ~/.zshrc

rbenv install 3.3.11
```

The project includes a `.ruby-version` file pinning `3.3.11` — rbenv picks this up automatically.

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

## Step 1: Install JS and Ruby dependencies

> **Important:** `bundle install` must use the rbenv-managed Ruby, not the macOS system Ruby. If you get a `Could not find 'bundler'` error, rbenv is not initialised in your current shell — run `eval "$(rbenv init -)"` first, or add it to your shell profile as shown in the setup section above.

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

- _"active developer directory is a command line tools instance"_ — run the `xcode-select --switch` command in the setup section above.
- _"iOS devices or simulators not detected"_ — the iOS simulator runtime has not been downloaded; run `xcodebuild -downloadPlatform iOS` or install it via Xcode → Settings → Platforms.
- _"Failed to build gem native extension"_ on `bundle install` — you are using the system Ruby. Install rbenv and Ruby 3.3 as described above.
- _`Could not find 'bundler' (2.x.x)`_ on `bundle install` — rbenv is installed but not initialised in the current shell. Run `eval "$(rbenv init -)"` or open a new terminal after adding it to your shell profile.
- _"Network request failed"_ in the simulator — the backend is not running. Start it with `docker-compose up` from the repo root (see Step 0 above).
- Pods out of date after pulling: `cd ios && bundle exec pod install`
- See the [React Native Troubleshooting](https://reactnative.dev/docs/troubleshooting) page for further help.
