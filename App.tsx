import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TouchableOpacity, Pressable, SafeAreaView, Alert } from 'react-native';
import { useState, useEffect } from 'react';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Key used to store recordings in AsyncStorage
// Think of this like a filename for our saved data
const STORAGE_KEY = 'echonote_recordings';

// Type definition for a recording entry
// This describes the shape of each recording we'll store
type Recording = {
  id: string;           // Unique identifier
  uri: string;          // File path to the audio file
  timestamp: Date;      // When it was recorded
  duration: number;     // Length in milliseconds
};

// Main App component
export default function App() {
  // State variables
  const [isRecording, setIsRecording] = useState(false);
  const [recordings, setRecordings] = useState<Recording[]>([]);

  // This holds the active recording object while recording
  // We need useRef-like behavior but useState works for our case
  const [currentRecording, setCurrentRecording] = useState<Audio.Recording | null>(null);

  // Permission state
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  // Playback state
  // Tracks which recording is currently playing (null if none)
  const [playingId, setPlayingId] = useState<string | null>(null);
  // The sound object used for playback
  const [sound, setSound] = useState<Audio.Sound | null>(null);

  // Load saved recordings from AsyncStorage
  async function loadRecordings() {
    try {
      console.log('Loading saved recordings...');

      // Get the stored data (it's stored as a JSON string)
      const storedData = await AsyncStorage.getItem(STORAGE_KEY);

      if (storedData) {
        // Parse the JSON string back into an array
        const parsed = JSON.parse(storedData);

        // Convert timestamp strings back to Date objects
        // (JSON.stringify converts Dates to strings, so we need to convert them back)
        const recordingsWithDates = parsed.map((rec: Recording) => ({
          ...rec,
          timestamp: new Date(rec.timestamp),
        }));

        setRecordings(recordingsWithDates);
        console.log(`Loaded ${recordingsWithDates.length} recordings`);
      }
    } catch (error) {
      console.error('Error loading recordings:', error);
    }
  }

  // Save recordings to AsyncStorage
  async function saveRecordings(recordingsToSave: Recording[]) {
    try {
      // Convert the array to a JSON string
      const jsonString = JSON.stringify(recordingsToSave);

      // Save to AsyncStorage
      await AsyncStorage.setItem(STORAGE_KEY, jsonString);

      console.log(`Saved ${recordingsToSave.length} recordings`);
    } catch (error) {
      console.error('Error saving recordings:', error);
    }
  }

  // useEffect runs when the component first loads
  // We use it to request microphone permission and load saved recordings
  useEffect(() => {
    // Define an async function to initialize the app
    async function initialize() {
      try {
        console.log('Initializing app...');

        // Load any previously saved recordings
        await loadRecordings();

        console.log('Requesting microphone permission...');

        // Ask the user for microphone permission
        const { status } = await Audio.requestPermissionsAsync();

        // status will be 'granted' if user said yes
        setHasPermission(status === 'granted');

        if (status !== 'granted') {
          Alert.alert(
            'Permission Required',
            'Please enable microphone access to record audio.'
          );
        }

        // Configure audio mode for recording
        // This tells iOS we want to record audio
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,          // Enable recording on iOS
          playsInSilentModeIOS: true,        // Play audio even in silent mode
        });

        console.log('App initialized!');
      } catch (error) {
        console.error('Error initializing app:', error);
        Alert.alert('Error', 'Failed to initialize app');
      }
    }

    // Call the async function
    initialize();
  }, []); // Empty array means this runs once when app starts

  // Function to start recording
  async function startRecording() {
    try {
      // Don't start if we don't have permission
      if (!hasPermission) {
        Alert.alert('Permission Required', 'Microphone access is needed to record.');
        return;
      }

      console.log('Starting recording...');

      // Create a new recording object
      const { recording } = await Audio.Recording.createAsync(
        // Use high quality preset for good audio
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      // Store the recording object so we can stop it later
      setCurrentRecording(recording);
      setIsRecording(true);

      console.log('Recording started!');
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Error', 'Could not start recording');
    }
  }

  // Function to stop recording
  async function stopRecording() {
    try {
      console.log('Stopping recording...');

      // Make sure we have an active recording
      if (!currentRecording) {
        console.log('No active recording to stop');
        return;
      }

      // Stop the recording
      await currentRecording.stopAndUnloadAsync();

      // Get the URI (file path) where the audio was saved
      const uri = currentRecording.getURI();

      // Get the recording status to find the duration
      const status = await currentRecording.getStatusAsync();

      console.log('Recording stopped! Saved to:', uri);
      console.log('Duration:', status.durationMillis, 'ms');

      // Create a new recording entry
      if (uri) {
        const newRecording: Recording = {
          id: Date.now().toString(),                    // Use timestamp as unique ID
          uri: uri,                                      // File path
          timestamp: new Date(),                         // Current date/time
          duration: status.durationMillis || 0,          // Duration in ms
        };

        // Add to our list of recordings
        // We use spread operator [...] to create a new array with the old items plus the new one
        const updatedRecordings = [...recordings, newRecording];
        setRecordings(updatedRecordings);

        // Save to persistent storage so recordings survive app restart
        await saveRecordings(updatedRecordings);
      }

      // Clean up
      setCurrentRecording(null);
      setIsRecording(false);

    } catch (error) {
      console.error('Failed to stop recording:', error);
      Alert.alert('Error', 'Could not stop recording');
    }
  }

  // Handle press down - start recording
  const handlePressIn = () => {
    startRecording();
  };

  // Handle press release - stop recording
  const handlePressOut = () => {
    if (isRecording) {
      stopRecording();
    }
  };

  // Play or stop a recording
  async function handlePlayPress(recording: Recording) {
    try {
      // If this recording is already playing, stop it
      if (playingId === recording.id) {
        console.log('Stopping playback...');
        if (sound) {
          await sound.stopAsync();
          await sound.unloadAsync();
        }
        setSound(null);
        setPlayingId(null);
        return;
      }

      // If a different recording is playing, stop it first
      if (sound) {
        await sound.stopAsync();
        await sound.unloadAsync();
      }

      console.log('Starting playback:', recording.uri);

      // Configure audio mode for playback
      // We need to disable recording mode to play audio
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      // Create a new sound object from the recording URI
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: recording.uri },
        { shouldPlay: true },  // Start playing immediately
        // This callback runs when playback status changes
        (status) => {
          // Check if playback finished
          if (status.isLoaded && status.didJustFinish) {
            console.log('Playback finished');
            setPlayingId(null);
            setSound(null);
            // Re-enable recording mode
            Audio.setAudioModeAsync({
              allowsRecordingIOS: true,
              playsInSilentModeIOS: true,
            });
          }
        }
      );

      setSound(newSound);
      setPlayingId(recording.id);

    } catch (error) {
      console.error('Error playing recording:', error);
      Alert.alert('Error', 'Could not play recording');
      setPlayingId(null);
      setSound(null);
    }
  }

  // Delete a recording
  function handleDeletePress(recording: Recording) {
    // Show confirmation dialog before deleting
    Alert.alert(
      'Delete Recording',
      'Are you sure you want to delete this recording?',
      [
        // Cancel button - does nothing
        {
          text: 'Cancel',
          style: 'cancel',
        },
        // Delete button - removes the recording
        {
          text: 'Delete',
          style: 'destructive',  // Makes it red on iOS
          onPress: async () => {
            try {
              // If this recording is currently playing, stop it first
              if (playingId === recording.id && sound) {
                await sound.stopAsync();
                await sound.unloadAsync();
                setSound(null);
                setPlayingId(null);
              }

              // Remove the recording from our array
              // filter() creates a new array with all items EXCEPT the one we're deleting
              const updatedRecordings = recordings.filter(
                (rec) => rec.id !== recording.id
              );

              // Update state
              setRecordings(updatedRecordings);

              // Save to storage
              await saveRecordings(updatedRecordings);

              console.log('Recording deleted:', recording.id);
            } catch (error) {
              console.error('Error deleting recording:', error);
              Alert.alert('Error', 'Could not delete recording');
            }
          },
        },
      ]
    );
  }

  // Helper function to format duration from ms to MM:SS
  function formatDuration(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    // padStart adds leading zeros: 5 becomes "05"
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  // Helper function to format timestamp
  function formatTimestamp(date: Date): string {
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>EchoNote</Text>
        <Text style={styles.subtitle}>
          {hasPermission === false
            ? 'Microphone permission required'
            : 'Hold to record a voice note'}
        </Text>
      </View>

      {/* Record Button */}
      <View style={styles.content}>
        <Pressable
          style={({ pressed }) => [
            styles.recordButton,
            isRecording && styles.recordingActive,
            hasPermission === false && styles.recordButtonDisabled,
            pressed && !isRecording && styles.recordButtonPressed
          ]}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={hasPermission === false}
          // Large offset so finger can move anywhere on screen
          pressRetentionOffset={{ top: 2000, bottom: 2000, left: 2000, right: 2000 }}
        >
          <View style={[
            styles.recordButtonInner,
            isRecording && styles.stopIcon
          ]} />
        </Pressable>
      </View>

      {/* Recordings List */}
      <View style={styles.listSection}>
        <Text style={styles.listTitle}>Your Recordings ({recordings.length})</Text>

        {recordings.length === 0 ? (
          <Text style={styles.emptyText}>No recordings yet</Text>
        ) : (
          // Map through recordings and display each one
          // Use slice() to create a copy, then reverse() to show newest first
          // (We copy first because reverse() modifies the original array)
          [...recordings].reverse().map((recording) => (
            <View key={recording.id} style={styles.recordingItem}>
              {/* Play/Stop button */}
              <TouchableOpacity
                style={[
                  styles.playButton,
                  playingId === recording.id && styles.playButtonActive
                ]}
                onPress={() => handlePlayPress(recording)}
              >
                {/* Show different icon based on playing state */}
                {playingId === recording.id ? (
                  // Stop icon (square)
                  <View style={styles.stopPlayIcon} />
                ) : (
                  // Play icon (triangle made with borders)
                  <View style={styles.playIcon} />
                )}
              </TouchableOpacity>

              {/* Recording info */}
              <View style={styles.recordingInfo}>
                <Text style={styles.recordingTime}>
                  {formatTimestamp(recording.timestamp)}
                </Text>
                <Text style={styles.recordingDuration}>
                  {formatDuration(recording.duration)}
                </Text>
              </View>

              {/* Delete button */}
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDeletePress(recording)}
              >
                <Text style={styles.deleteButtonText}>X</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },

  // Header styles
  header: {
    paddingTop: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1a1a2e',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
  },

  // Content area
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Record button
  recordButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#ff4757',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  recordingActive: {
    backgroundColor: '#c0392b',
  },
  recordButtonPressed: {
    opacity: 0.7,
  },
  recordButtonDisabled: {
    backgroundColor: '#ccc',
  },
  recordButtonInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
  },
  stopIcon: {
    borderRadius: 4,
    width: 30,
    height: 30,
  },

  // Recordings list
  listSection: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    minHeight: 200,
  },
  listTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a2e',
    marginBottom: 12,
  },
  emptyText: {
    color: '#999',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 20,
  },

  // Individual recording item
  recordingItem: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  recordingInfo: {
    flex: 1,            // Take up available space between play and delete buttons
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  recordingTime: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1a1a2e',
  },
  recordingDuration: {
    fontSize: 14,
    color: '#666',
  },

  // Play button styles
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#4CAF50',  // Green color
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  playButtonActive: {
    backgroundColor: '#f44336',  // Red when playing (to indicate stop)
  },
  // Play icon - triangle made with CSS borders trick
  playIcon: {
    width: 0,
    height: 0,
    borderLeftWidth: 12,
    borderTopWidth: 8,
    borderBottomWidth: 8,
    borderLeftColor: '#fff',
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    marginLeft: 4,  // Center the triangle visually
  },
  // Stop icon - small square
  stopPlayIcon: {
    width: 14,
    height: 14,
    backgroundColor: '#fff',
    borderRadius: 2,
  },

  // Delete button
  deleteButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ffebee',  // Light red background
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 'auto',  // Push to the right side
  },
  deleteButtonText: {
    color: '#f44336',  // Red text
    fontSize: 14,
    fontWeight: 'bold',
  },
});
