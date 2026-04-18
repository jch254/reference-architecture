React Native mobile app, bootstrapped using [`@react-native-community/cli`](https://github.com/react-native-community/cli).

# Prerequisites

- [Node.js](https://nodejs.org/) and [pnpm](https://pnpm.io/)
- **iOS**: [Xcode](https://apps.apple.com/app/xcode/id497799835) (full app from the Mac App Store — Command Line Tools alone are not sufficient)
- **Android**: [Android Studio](https://developer.android.com/studio)

See the full [Set Up Your Environment](https://reactnative.dev/docs/set-up-your-environment) guide for details.

## macOS: ensure Xcode is the active developer directory

After installing Xcode, point `xcode-select` at it (required if only Command Line Tools were previously installed):

```sh
sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
sudo xcodebuild -license accept
```

# Running locally

## Step 1: Install dependencies

```sh
pnpm install
```

Install CocoaPods dependencies for iOS (first run, or after updating native deps):

```sh
bundle install
cd ios && bundle exec pod install && cd ..
```

## Step 2: Start Metro

Start the Metro dev server from the project root:

```sh
pnpm start
```

## Step 3: Run on a simulator or device

With Metro running, open a new terminal and run:

### iOS

```sh
pnpm ios
# or target a specific simulator:
pnpm ios --simulator "iPhone 16"
```

### Android

```sh
pnpm android
```

## Fast Refresh (hot reload)

[Fast Refresh](https://reactnative.dev/docs/fast-refresh) is enabled by default. Save any file and the app updates instantly without losing component state.

To force a full reload:

- **iOS Simulator**: Press <kbd>R</kbd>
- **Android Emulator**: Press <kbd>R</kbd> twice, or <kbd>Cmd ⌘</kbd> + <kbd>M</kbd> (macOS) to open the Dev Menu

# Troubleshooting

- `xcodebuild` requires the full Xcode app — run the `xcode-select --switch` command above if you see _"active developer directory is a command line tools instance"_.
- If pods are out of date after pulling: `cd ios && bundle exec pod install`
- See the [React Native Troubleshooting](https://reactnative.dev/docs/troubleshooting) page for common issues.
