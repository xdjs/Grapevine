# Loading Screen Feature

## Overview

A new loading screen component has been implemented to provide better user feedback during artist network generation. The loading screen displays when an artist's collaboration network is being generated and provides visual feedback about the data sources being queried.

## Features

### Visual Design
- **Modern UI**: Dark theme with pink accent colors matching the app's design
- **Animated Elements**: Spinning loader, pulsing border, and bouncing dots
- **Responsive Design**: Adapts to different screen sizes
- **Backdrop Blur**: Semi-transparent overlay with blur effect

### Content
- **Dynamic Artist Name**: Shows "Generating [Artist Name]'s Network" when available
- **Progress Indicators**: Visual icons for MusicBrainz, Spotify, and Collaborations
- **Informative Text**: Explains what's happening during the generation process
- **Status Message**: "This may take a few moments as we gather authentic collaboration data"

### Technical Implementation

#### Component: `LoadingScreen`
- **Location**: `client/src/components/loading-screen.tsx`
- **Props**:
  - `isVisible: boolean` - Controls visibility
  - `artistName?: string` - Optional artist name for personalized message

#### Integration Points
- **Home Page**: `client/src/pages/home.tsx`
- **Artist Network Page**: `client/src/pages/artist-network.tsx`
- **Search Interface**: `client/src/components/search-interface.tsx`

#### State Management
- Tracks current artist name during loading
- Passes artist name through loading change handlers
- Maintains loading state across components

## Usage

The loading screen automatically appears when:
1. User searches for an artist
2. User selects an artist from dropdown
3. User clicks on a history item
4. Artist network is being generated from URL parameters

## Animation Details

- **Main Spinner**: Continuous rotation with `animate-spin`
- **Pulsing Border**: Subtle pulse effect around the main spinner
- **Bouncing Dots**: Three dots with staggered animation delays (0ms, 150ms, 300ms)
- **Smooth Transitions**: Backdrop blur and opacity changes

## Data Sources Displayed

The loading screen shows icons for the three main data sources:
- **MusicBrainz**: Database icon for collaboration data
- **Spotify**: Music icon for artist images and metadata
- **Collaborations**: Users icon for network relationships

## Accessibility

- High contrast text for readability
- Proper semantic structure
- Screen reader friendly content
- Keyboard navigation support

## Future Enhancements

Potential improvements could include:
- Progress percentage display
- Estimated time remaining
- More detailed status messages
- Animation customization options
- Dark/light theme support 