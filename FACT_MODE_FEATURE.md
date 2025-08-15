# Fact Mode Feature

## Overview
The Fact Mode feature adds an interactive way to discover fun facts about music artists and collaborators in the network visualization. When activated, users can click on collaboration details to generate interesting facts about the selected artist.

## Features

### Fact Mode Button
- **Location**: Top-left corner of the network visualization area
- **Appearance**: Yellow button with lightbulb icon when active, gray when inactive
- **Functionality**: Toggles Fact Mode on/off
- **Visual Feedback**: Shows a pulsing dot when active

### Floating Facts Box
- **Location**: Below the Fact Mode button, on the left side
- **Appearance**: Semi-transparent black box with yellow accents
- **Content**: Displays fun facts about the selected artist
- **Features**:
  - Auto-rotates through multiple facts every 8 seconds
  - Shows fact counter dots for multiple facts
  - Faint design that doesn't distract from the main visualization
  - Close button to dismiss the facts

### Fact Generation
- **AI-Powered**: Uses OpenAI GPT-3.5-turbo to generate unique facts
- **Fallback System**: Includes predefined facts for popular artists
- **Generic Facts**: Provides fallback facts for unknown artists
- **Caching**: Stores generated facts to avoid repeated API calls

## How to Use

1. **Enable Fact Mode**: Click the "Fact Mode" button in the top-left corner
2. **Select an Artist**: Click on any artist node in the network
3. **View Collaboration Details**: Click on the collaboration details option
4. **See Facts**: Fun facts about the selected artist will appear in the floating box
5. **Disable Fact Mode**: Click the Fact Mode button again to turn it off

## Technical Implementation

### Components
- `FactModeButton`: Toggle button for enabling/disabling fact mode
- `FloatingFactsBox`: Display component for showing facts
- `FactsService`: Service for generating and managing facts

### API Endpoint
- **Route**: `/api/generate-facts`
- **Method**: POST
- **Input**: `{ artistName: string }`
- **Output**: `{ facts: string[], artistName: string, generatedAt: string }`

### Integration Points
- Integrated into `NetworkVisualizer` component
- Works on both home page and artist network pages
- Automatically triggers when collaboration details are opened in fact mode

## Fallback Facts

The system includes predefined facts for popular artists:
- Taylor Swift
- Jack Antonoff
- Lorde
- Lana Del Rey

For unknown artists, generic facts are provided covering:
- Career achievements
- Collaboration history
- Musical influence
- Industry recognition
- Touring experience

## Error Handling

- Graceful fallback to predefined facts if AI generation fails
- Rate limiting protection for OpenAI API calls
- User-friendly error messages
- Automatic retry mechanisms

## Performance Considerations

- Facts are cached to minimize API calls
- Lazy loading of fact generation
- Non-blocking UI updates
- Efficient state management

## Future Enhancements

- More artist-specific fact databases
- User-contributed facts
- Fact categories and filtering
- Integration with music databases
- Social sharing of interesting facts
