# Collaboration Details Feature

## Overview

The Collaboration Details feature allows users to view detailed information about collaborations between artists in the network visualization. When clicking on any collaborator node (not the main artist), a popup window displays information about their collaboration relationship, including specific projects they worked on together and Spotify links when available.

## How It Works

### User Interaction
1. **Main Artist Node**: Clicking on the main artist (center node) shows the regular tooltip with network and profile options
2. **Collaborator Nodes**: Clicking on any collaborator node opens a collaboration details popup

### API Endpoint
- **URL**: `/api/collaboration-details/[artistName]/[collaboratorName]`
- **Method**: GET
- **Purpose**: Generates collaboration details using OpenAI and enhances with Spotify data

### Data Flow
1. User clicks on a collaborator node
2. System determines the relationship (direct to main artist or through intermediate collaborator)
3. API call is made to fetch collaboration details
4. OpenAI generates a description and project list
5. Spotify API enhances projects with links (if configured)
6. Popup displays the information

## Features

### Collaboration Details Popup
- **Description**: Brief sentence describing the collaboration relationship
- **Projects**: List of specific songs, albums, EPs, or singles they worked on together
- **Spotify Links**: Direct links to projects on Spotify (when available)
- **Personal History**: Background information about their relationship (when available)
- **Loading States**: Shows loading spinner while fetching data
- **Error Handling**: Displays error messages and retry options

### Visual Design
- **Modal Popup**: Full-screen overlay with centered content
- **Responsive**: Adapts to mobile and desktop screen sizes
- **Icons**: Different icons for different project types (song, album, EP, single)
- **Spotify Integration**: Green external link icons for Spotify URLs

## Technical Implementation

### Components
- `CollaborationDetailsPopup`: Main popup component
- `NetworkVisualizer`: Modified to handle collaborator clicks

### API Integration
- **OpenAI**: Generates collaboration descriptions and project lists
- **Spotify**: Enhances projects with direct links
- **Error Handling**: Graceful fallbacks when services are unavailable

### Environment Variables Required
```env
# Required
OPENAI_API_KEY=your_openai_api_key

# Optional (for Spotify enhancement)
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
```

## Example API Response

```json
{
  "description": "Taylor Swift and Jack Antonoff have collaborated extensively as producer and songwriter, working together on multiple albums including '1989', 'Reputation', and 'Lover'.",
  "projects": [
    {
      "name": "1989",
      "type": "album",
      "year": "2014",
      "spotifyUrl": "https://open.spotify.com/album/2QJmrSgbdM35R67eoGQo4j"
    },
    {
      "name": "Reputation",
      "type": "album", 
      "year": "2017",
      "spotifyUrl": "https://open.spotify.com/album/6DEjYFkNZh67HP7R9PSZvv"
    }
  ],
  "personalHistory": "Jack Antonoff has been one of Taylor Swift's most consistent collaborators since 2014, serving as producer and co-writer on many of her biggest hits."
}
```

## Usage

1. **Search for an artist** using the search interface
2. **View the network visualization** showing collaborators
3. **Click on any collaborator node** (not the main artist)
4. **View collaboration details** in the popup window
5. **Click Spotify links** to open projects in Spotify
6. **Close the popup** using the X button or Close button

## Error Handling

- **OpenAI Unavailable**: Shows error message with retry option
- **No Collaborations Found**: Displays appropriate message
- **Network Errors**: Shows error details and retry functionality
- **Spotify Enhancement Fails**: Continues without Spotify links

## Future Enhancements

- **Caching**: Cache collaboration details to reduce API calls
- **More Music Services**: Add links to Apple Music, YouTube Music, etc.
- **Collaboration Timeline**: Show chronological order of collaborations
- **Social Media Integration**: Include social media profiles
- **Collaboration Statistics**: Show number of projects, years active, etc. 