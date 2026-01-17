# EchoNote

A simple voice notes app built with React Native and Expo. Press and hold to record, release to save.

## Features

- **Press-and-hold recording** - Hold the button to record, release anywhere on screen to stop
- **Playback** - Tap any recording to play/stop
- **Persistent storage** - Recordings survive app restarts
- **Delete with confirmation** - Remove recordings you don't need

## Getting Started

### Prerequisites

- Node.js
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (Xcode) or Android Emulator, or Expo Go app on your phone

### Installation

```bash
# Install dependencies
npm install

# Run on iOS
npm run ios

# Run on Android
npm run android

# Or start Expo and scan QR code with Expo Go
npm run start
```

## Tech Stack

- **Expo** - React Native framework
- **TypeScript** - Type-safe JavaScript
- **expo-av** - Audio recording and playback
- **AsyncStorage** - Persistent local storage

## How It Works

1. App requests microphone permission on first launch
2. Press and hold the red button to start recording
3. Release to stop and save the recording
4. Recordings appear in a list (newest first)
5. Tap the green play button to listen
6. Tap X to delete a recording

## Project Structure

```
EchoNote/
├── App.tsx          # Main app component (all UI and logic)
├── app.json         # Expo configuration
├── package.json     # Dependencies
├── tsconfig.json    # TypeScript config
└── assets/          # App icons and splash screen
```

## License

MIT
