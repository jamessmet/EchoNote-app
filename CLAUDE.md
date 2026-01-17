# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
npm run ios      # Run on iOS simulator
npm run android  # Run on Android emulator
npm run start    # Start Expo dev server (scan QR with Expo Go app)
```

## Architecture

EchoNote is a single-file Expo/React Native app for recording voice notes. All code lives in `App.tsx`.

**Key Dependencies:**
- `expo-av` - Audio recording (`Audio.Recording`) and playback (`Audio.Sound`)
- `@react-native-async-storage/async-storage` - Persistent storage for recording metadata

**Data Flow:**
- Recording metadata (id, uri, timestamp, duration) stored in AsyncStorage under key `echonote_recordings`
- Audio files saved automatically by expo-av to app's cache directory
- Recordings array reversed for display (newest first)

**Recording Interaction:**
- Uses `Pressable` with `onPressIn`/`onPressOut` for press-and-hold recording
- `pressRetentionOffset: 2000` allows finger to move anywhere on screen while recording

**Audio Mode Switching:**
- Must call `Audio.setAudioModeAsync({ allowsRecordingIOS: true })` before recording
- Must call `Audio.setAudioModeAsync({ allowsRecordingIOS: false })` before playback
