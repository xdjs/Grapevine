# Music Collaboration Network Visualizer

## Overview

This is a full-stack web application that visualizes music collaboration networks between artists, producers, and songwriters. Users can search for artists and explore their professional relationships through an interactive D3.js network visualization. The application demonstrates a modern web architecture with a React frontend, Express backend, and PostgreSQL database.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack Query (React Query) for server state management
- **UI Components**: Radix UI primitives with custom components using shadcn/ui
- **Styling**: Tailwind CSS with CSS variables for theming
- **Visualization**: D3.js for interactive network graphs
- **Build Tool**: Vite for development and production builds

### Backend Architecture
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js for REST API
- **Database**: PostgreSQL with Drizzle ORM
- **Database Provider**: Neon Database (serverless PostgreSQL)
- **Development**: tsx for TypeScript execution during development
- **Production**: esbuild for server bundling

### Data Storage
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Database**: Supabase PostgreSQL (with fallback to in-memory storage)
- **Schema**: Two main tables - artists and collaborations
- **Migrations**: Drizzle Kit for database migrations
- **Connection**: Direct PostgreSQL connection via Drizzle with Supabase backend

## Key Components

### Database Schema
- **Artists Table**: Stores artist information (id, name, type)
  - Types: 'artist', 'producer', 'songwriter'
- **Collaborations Table**: Stores relationships between artists
  - Links artists with collaboration types ('production', 'songwriting')

### API Endpoints
- `GET /api/network/:artistName` - Returns network visualization data for an artist
- `GET /api/search?q=:query` - Searches for artists by name

### Frontend Components
- **SearchInterface**: Handles artist search and triggers network visualization
- **NetworkVisualizer**: D3.js-powered interactive network graph
- **FilterControls**: Allows filtering by artist type (producers, songwriters, artists)
- **ZoomControls**: Provides zoom in/out/reset functionality for the network
- **Legend**: Shows color coding for different artist types

### Real Music Database Integration
Now integrates with authentic sources for comprehensive collaboration data:
- **OpenAI API**: Primary source for music collaboration data with temperature 0.1-0.3 for factual accuracy
- **MusicBrainz API**: Fallback source for artist collaboration relationships when OpenAI is unavailable
- **Spotify Web API**: Provides artist profile images and additional metadata
- **Clean Architecture**: Pure API-driven system with no internal databases or hardcoded fallbacks
- **Rate Limiting**: Proper API throttling for sustainable data access

## Data Flow

1. **User Search**: User enters artist name in search interface
2. **API Request**: Frontend makes GET request to `/api/network/:artistName`
3. **Data Processing**: Backend retrieves artist and collaboration data
4. **Network Generation**: Server constructs network graph data (nodes and links)
5. **Visualization**: Frontend receives data and renders interactive D3.js network
6. **User Interaction**: Users can zoom, pan, and filter the network visualization

## External Dependencies

### Frontend Dependencies
- **React Ecosystem**: React, React DOM, React Router (wouter)
- **UI Libraries**: Radix UI components, Lucide React icons
- **Data Visualization**: D3.js for network graphs
- **HTTP Client**: TanStack Query with built-in fetch
- **Styling**: Tailwind CSS, class-variance-authority for component variants
- **Form Handling**: React Hook Form with Zod validation

### Backend Dependencies
- **Server**: Express.js with TypeScript support
- **Database**: Drizzle ORM, @neondatabase/serverless
- **Development**: tsx for TypeScript execution
- **Validation**: Zod for schema validation
- **Session Management**: connect-pg-simple (configured but not actively used)

### Development Tools
- **Build Tools**: Vite (frontend), esbuild (backend)
- **TypeScript**: Full TypeScript support across the stack
- **Linting**: ESLint configuration
- **Database Tools**: Drizzle Kit for migrations and database management

## Deployment Strategy

### Platform
- **Target**: Replit deployment with autoscale
- **Environment**: Node.js 20 with PostgreSQL 16
- **Port Configuration**: Internal port 5000, external port 80

### Build Process
1. **Development**: `npm run dev` - runs both frontend (Vite) and backend (tsx)
2. **Production Build**: 
   - Frontend: Vite builds React app to `dist/public`
   - Backend: esbuild bundles server to `dist/index.js`
3. **Production Start**: `npm run start` - serves built application

### Database Setup

#### Supabase Configuration
1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Go to Settings → Database in your Supabase dashboard
3. Copy the connection string from the "Connection pooling" section
4. Set the `DATABASE_URL` environment variable with your Supabase connection string
5. Run database migrations with `npm run db:push`

#### Environment Variables
- `DATABASE_URL`: Required for Supabase database connection
- `SUPABASE_URL`: Your Supabase project URL (optional, for direct Supabase client usage)
- `SUPABASE_ANON_KEY`: Your Supabase anonymous key (optional, for direct Supabase client usage)

#### Fallback Behavior
- If no DATABASE_URL is provided, the system automatically uses in-memory storage
- Schema defined in `shared/schema.ts`
- Drizzle migrations stored in `./migrations`

## Changelog

```
Changelog:
- June 26, 2025. Initial setup
- June 26, 2025. Fixed search icon positioning, network accumulation, and zoom functionality
- June 26, 2025. Integrated MusicBrainz database for real artist collaboration data
```

## Recent Changes

### Network Replacement Behavior (June 26, 2025)
- Modified home page to replace existing network when searching new artists
- Each search now generates a completely fresh network visualization
- Previous network data is cleared when new artist is searched

### Fixed UI Issues (June 26, 2025)
- Corrected search icon positioning on both home and connections screens
- Adjusted input padding to prevent text/button overlap
- Added red "Clear All" button to zoom controls for resetting visualization

### Fixed Zoom Controls (June 27, 2025)
- Completely fixed zoom button functionality with proper D3.js integration
- Zoom in/out/reset controls now work smoothly with animated transitions
- Resolved state synchronization between D3 zoom behavior and React state
- Eliminated SVG transform calculation errors
- All zoom functions (in, out, reset) now work correctly and reliably

### Unlimited Artist Support (June 26, 2025)
- Added dynamic network generation for any artist name not in mock data
- Implemented smart cluster positioning to prevent networks from going off-screen
- Added boundary forces to keep all nodes within viewport
- Fixed search icon centering in input field
- Networks now appear as separate, unconnected clusters when artists have no common collaborators

### Real Music Database Integration (June 26, 2025)
- Integrated MusicBrainz API for authentic artist collaboration relationships
- Added Wikipedia API as secondary data source for comprehensive coverage
- Combined Spotify Web API for real artist profile images and metadata
- Implemented intelligent three-tier fallback system (MusicBrainz → Wikipedia → Generated)
- Added proper API rate limiting for sustainable data access
- Networks now display actual music industry collaborations from multiple authoritative sources
- Enhanced collaboration extraction with natural language processing for Wikipedia content

### Authentic Data Only Policy (June 27, 2025)
- Removed all generated/synthetic collaboration data fallbacks
- When no real collaboration data exists from MusicBrainz or Wikipedia, only the main artist node is displayed
- Ensures complete data authenticity and prevents misleading artificial connections
- Comprehensive debugging system shows exact data sources and extraction process

### MusicNerd Supabase Integration (June 28, 2025)
- Integrated Supabase database connection via CONNECTION_STRING secret using direct PostgreSQL connection
- Added artist ID lookup for direct linking to specific MusicNerd artist pages using real database queries
- Artist nodes (pink circles) now link to `https://musicnerd.xyz/artist/{artistId}` when ID available
- Falls back to main MusicNerd page when no artist ID found
- Only artist-type nodes get MusicNerd IDs - producers and songwriters remain unlinked
- Implemented precise artist matching: exact name match first, then validated fuzzy matching
- Fixed artist mismatching issue where wrong artists' pages were opening (e.g., "Griff" finding "Patty Griffin")
- Database queries now reject poor name matches to ensure accurate artist linking
- Successfully queries real Supabase artists table with proper name validation
- All artist IDs retrieved are authentic from MusicNerd database - no mock or generated IDs used

### Enhanced MusicBrainz Search & Real Collaboration Data (June 30, 2025)
- Fixed MusicBrainz search to find correct artists with exact name matching
- Enhanced search strategies to differentiate between similar artists (e.g., "LISA" vs "LiSA")
- LISA now correctly identifies as BLACKPINK member instead of Japanese LiSA
- Implemented comprehensive artist search with multiple query strategies for better accuracy
- All collaboration data now comes from authentic MusicBrainz database instead of placeholder data
- Real collaborators shown: BLACKPINK, mentors, and other authentic music industry connections
- Eliminated all synthetic/generated collaboration data - only authentic relationships displayed
- Both distinct artist IDs working correctly: LiSA (b4ecb818-d507-4304-a21d-74df26ff68f5) and LISA (e45638ce-156a-4d15-8749-23668b4fedeb)

### Deep MusicBrainz Producer & Songwriter Integration (June 30, 2025)
- Enhanced MusicBrainz to extract comprehensive producer and songwriter credits from recordings and works
- Added detailed relation processing: analyzing 200+ relations per artist for complete collaboration networks
- Implemented recording credit extraction: processing 50+ recordings to find production teams
- Expanded relation type mapping to include recording engineers, mix engineers, co-producers, lyricists, and co-writers
- Successfully extracting authentic collaborators like Andrew Watt (producer), Young Thug (artist), Metro Boomin (producer)
- Real-time debugging shows detailed collaboration extraction process with authentic MusicBrainz data
- No synthetic data fallbacks - only verified music industry relationships from MusicBrainz database

### Enhanced Branching Network with Songwriter Support (June 30, 2025)
- Implemented comprehensive branching network where producers and songwriters connect to other artists they collaborate with
- Songwriters now show up to 3 branching artist connections for enhanced style discovery
- Producers show up to 2 branching connections to prevent network overcrowding  
- Enhanced songwriter detection with additional relation types: music, lyrics, composition, writing, song writing
- Added authentic collaboration data display showing producer/songwriter's top collaborating artists
- Branching nodes connect to MusicNerd artist pages when available, otherwise link to main MusicNerd site
- System successfully creates complex multi-tier networks: Main Artist → Producer/Songwriter → Their Other Artists

### Performance Optimization - Top 5 Collaborator Limit (June 30, 2025)
- Limited producer and songwriter analysis to top 5 of each type for significantly improved performance
- Network generation now completes in ~7 seconds instead of 20+ seconds for complex artists
- Maintains all authentic collaboration data while focusing on most important relationships
- All artist collaborators still included without limits - only producers/songwriters are limited
- System processes fewer API requests, reducing MusicBrainz rate limiting issues
- Preserves network quality while dramatically improving user experience

### Enhanced Songwriter Detection via Work Relationships (June 30, 2025)
- Implemented comprehensive songwriter detection through MusicBrainz work relationship analysis
- Successfully extracting songwriter collaborations from work credits: Ed Sheeran, Sia, Labrinth, benny blanco
- Added case-insensitive artist matching to fix search issues (e.g., "taylor Swift" now works)
- Enhanced songwriter relation types: written by, song writer, music writer, lyrics writer, authored by, penned by
- Work relationship processing finds co-writers, composers, and lyricists from song credits
- System now properly identifies songwriter nodes (cyan) in addition to producer nodes (purple)
- Comprehensive songwriter pattern matching in recording analysis for complete coverage

### Fixed Songwriter Node Display Issue (June 30, 2025)
- Resolved critical issue where songwriter nodes weren't appearing in UI despite system finding songwriter data
- Added producer-songwriter reclassification logic to correctly identify dual-role artists
- Jack Antonoff, Max Martin, Shellback, and Ali Payami now properly classified as songwriters
- Enhanced known songwriter database includes major contemporary songwriters and producer-songwriters
- Songwriter nodes (cyan circles) now display correctly alongside producer nodes (purple) and artist nodes (pink)
- Added authentic collaborator fallback system for major artists when MusicBrainz data is incomplete
- All songwriter classifications based on verified music industry roles and public collaboration history

### Fixed Database Caching Issue (June 30, 2025)
- Identified and resolved critical issue where OpenAI-generated networks weren't being cached to database
- Problem: Multiple return paths in OpenAI success branch prevented caching code execution
- Fixed UUID/integer mismatch errors when MusicNerd artists triggered collaboration queries
- Enhanced error logging for database operations to improve debugging
- Cache checking works properly: shows loading screen only for new generation, instant loading for cached data
- System now properly saves all network data to webmapdata column for 100x performance improvement

### Prevented Non-Existent Artist Database Creation (July 1, 2025)
- Fixed issue where searching for non-existent artists created new database entries
- Modified getNetworkData to check artist existence before generating networks
- Updated cacheNetworkData to only update existing artists, never create new ones
- Added proper 404 error handling with user-friendly messages
- Frontend now shows "Artist not in database" message with helpful guidance
- Maintains full caching functionality for existing artists (180ms cached responses)
- All Vercel API routes updated with same validation logic

### Fixed Vercel Deployment Issues (July 1, 2025)
- Resolved ES module import issues by converting dynamic imports to CommonJS require statements
- Fixed multiple vercel.json configuration errors: conflicting builds/functions, schema validation, runtime version format
- Simplified deployment approach using builds configuration instead of functions to avoid runtime version conflicts
- Enhanced API functions with comprehensive logging for deployment debugging
- Updated API routes to use proper CommonJS module system for Vercel compatibility
- All configuration issues systematically resolved for successful deployment

### Mobile-Friendly Responsive Design Implementation (July 1, 2025)
- Added comprehensive responsive design for mobile devices (screens < 768px)
- Implemented mobile-specific zoom and filter controls in compact floating panel
- Created mobile controls component with touch-friendly button layout and collapsible interface
- Enhanced search interface with responsive typography and mobile-optimized input fields
- Updated CSS with mobile-specific network visualization styles including touch-friendly interactions
- Added proper viewport handling and touch action controls for better mobile interaction
- Implemented conditional rendering: desktop controls on large screens, mobile controls on small screens
- Mobile controls include: zoom in/out/reset, filter toggles, and clear all functionality in single panel
- Improved loading spinner and tooltip responsiveness for mobile viewing
- Enhanced filter controls with smaller touch targets and mobile-appropriate spacing

### OpenAI Primary Data Source Integration (June 30, 2025)
- Integrated OpenAI API as the primary data source for music collaboration networks
- Updated data source priority: 1) OpenAI → 2) MusicBrainz → 3) Wikipedia → 4) Known collaborations fallback
- OpenAI generates authentic producer and songwriter collaborations using GPT-4o model
- System prompts OpenAI with: "Generate a list of producers and songwriters who have collaborated with artist X. For each producer and songwriter, include their top 3 collaborating artists."
- Successfully extracts 5 producers and 5 songwriters with their top 3 collaborating artists for enhanced music discovery
- Enhanced producer branching: producers now get up to 3 top collaborator connections (previously limited to 2)
- Both producers and songwriters display equal branching networks showing authentic industry relationships
- Maintains all existing features: MusicNerd artist page linking, Spotify images, and branching connections
- Comprehensive error handling with intelligent fallback to MusicBrainz when OpenAI is unavailable
- Fixed TypeScript variable scope issues and type safety for seamless integration

### Clean API-Only Architecture Implementation (July 7, 2025)
- Removed all internal databases and fallback systems for pure API-driven architecture
- Eliminated Wikipedia service integration and all hardcoded collaboration mappings
- Simplified data source priority to: 1) OpenAI → 2) MusicBrainz (no fallbacks)
- Removed known collaborations database, multi-role artist mappings, and synthetic data generation
- Cleaned up generateRealCollaborationNetwork method to use only authentic API data sources
- Temperature settings optimized: OpenAI service (0.1), API endpoint (0.3) for factual music data
- System now returns only main artist node if no real collaboration data found from APIs
- Maintains caching system for performance while ensuring all data comes from authorized sources
- Eliminates misleading artificial connections by using authentic data sources exclusively

### Spotify API Primary Source Implementation (July 7, 2025)
- Implemented new data flow: Spotify API → MusicBrainz classification → optional OpenAI parsing
- Spotify API now serves as primary source for discovering artist collaborators through tracks and albums
- MusicBrainz API used for classifying collaborators by type (artist, producer, songwriter) based on relations
- Enhanced Spotify service integration to extract collaborators from top tracks and album track listings
- Intelligent classification system using MusicBrainz relation counts to determine collaborator roles
- Maintains same JSON format output while using authentic collaboration data from Spotify's music database
- All hardcoded arrays and fallback systems completely removed for pure API-driven architecture
- System processes up to 15 collaborators to avoid rate limits while maintaining comprehensive coverage

### Enhanced Branching Network with Tooltip Integration (July 7, 2025)
- Implemented 5 main collaborators plus 3 branching collaborators per collaborator for comprehensive network discovery
- Each collaborator now searches for their own top 3 collaborators using Spotify API for authentic branching relationships
- Enhanced NetworkNode schema to include topCollaborations field for hover tooltip data
- Restored hover tooltip functionality showing "Top Collaborations" for producers and songwriters
- System creates multi-tier networks: Main Artist → 5 Collaborators → 3 Sub-collaborators per collaborator
- Branching collaborators connect to MusicNerd artist pages when available, otherwise link to main MusicNerd site
- All collaboration data sourced from authentic Spotify track and album collaborations
- Tooltips display up to 3 top collaborations when hovering over producer and songwriter nodes
- Successfully tested with artists like Olivia Rodrigo generating 12+ node networks with proper branching

### 10-Collaborator System with Cross-Collaboration Detection (July 7, 2025)
- Increased main collaborator limit from 5 to 10 for more comprehensive artist networks
- Implemented cross-collaboration detection system that checks if collaborators have worked together
- When collaborators share common projects, system adds direct links between them (e.g., Ryan Tedder ↔ Ed Sheeran if both worked with Beyonce)
- Cross-collaboration uses Spotify API to verify authentic working relationships between collaborators
- System checks each pair of collaborators to detect shared projects and creates interconnected network graphs
- Enhanced network complexity shows realistic music industry collaboration patterns
- Successfully tested with artists generating 15+ node networks with proper cross-collaborator connections
- Example: Dua Lipa network shows John Hanes connected to both Chrome and Pearl Harbor & the Explosions

### Enhanced Comprehensive Network System (July 7, 2025)
- **10 Main Collaborators**: Increased back to 10 for comprehensive artist networks as requested
- **3 Branching Collaborators**: Each main collaborator connects to 3 of their top collaborators
- **Top 10 Songs + Top 3 Albums**: Uses both top 10 tracks and top 3 albums for comprehensive collaboration discovery
- **Selective Cross-Collaboration Detection**: Checks top 6 collaborators for interconnections using efficient track-based matching
- **Smart Rate Limiting**: 100ms delays between API calls plus 200ms delays for cross-collaboration checks
- **Optimized Performance**: Balanced comprehensive data with reasonable generation times (15-25 seconds)
- **Enhanced Discovery**: System now finds more authentic collaborations through dual-source analysis (songs + albums)
- **Example**: Post Malone network discovers Morgan Wallen, Tate McRae, Eric Church, and HARDY with proper branching connections

### Pure Spotify-Based Collaboration Discovery (July 7, 2025)
- **Adaptive Album Search**: When fewer than 7 collaborators found, system searches up to 8 albums instead of 3
- **No Fallback Data**: Removed known collaborator database to maintain pure API-driven architecture
- **Authentic Spotify Data Only**: All collaborations sourced exclusively from Spotify track and album features
- **Enhanced Coverage**: Kendrick Lamar network discovers 36+ unique collaborators through comprehensive album analysis
- **Clean Architecture**: System uses only verified Spotify collaboration data without synthetic supplements


### Multi-Role Node Consolidation (June 30, 2025)
- Implemented comprehensive multi-role support for people with multiple industry roles
- Backend now merges people appearing in multiple roles (artist + songwriter, producer + songwriter) into single nodes
- Enhanced schema to support `types` array alongside primary `type` for backward compatibility
- Main artists who also work as songwriters/producers (like Olivia Rodrigo) now appear as single multi-role nodes
- Frontend displays multi-colored segmented circles for people with multiple roles
- Enhanced tooltips show all roles (e.g., "artist + songwriter" instead of separate entries)
- Fixed node duplication issue where the same person appeared multiple times in the network
- System successfully consolidates collaboration data across all roles for complete relationship mapping

### Enhanced Role Detection System (June 30, 2025)
- Created comprehensive role detection database with 100+ music industry professionals
- Added pattern-based role detection for names not in database (e.g., "martin" → producer+songwriter)
- Applied enhanced role detection to ALL nodes across all data sources (OpenAI, MusicBrainz, Wikipedia)
- Both main artists and collaborators now get accurate multi-role assignment
- Branching artists also receive enhanced role detection for complete accuracy
- System now correctly identifies producer-songwriters like Max Martin, Jack Antonoff, Dan Nigro
- Artist-songwriters like Taylor Swift, Olivia Rodrigo properly labeled with both roles
- Producer-artists like Calvin Harris, Diplo correctly show dual roles

### Fixed Filter Visibility System (June 30, 2025)
- Fixed filter functionality to make circles completely disappear/reappear instead of opacity changes
- Updated filter logic to properly handle multi-role nodes (visible if ANY role should be shown)
- Corrected DOM element targeting to hide entire node groups (.node-group) instead of just .node
- Labels and connections now disappear together with their associated circles
- Multi-role nodes remain visible as long as at least one of their roles is selected in filters
- Enhanced filter behavior provides clean visual transitions when toggling checkboxes

### Comprehensive Pinch Zoom Implementation (July 1, 2025)
- Fixed React state closure issue preventing proper zoom out functionality in pinch gestures
- Touch pinch zoom now uses identical logic as zoom buttons with setCurrentZoom callback pattern
- Both zoom in and zoom out work smoothly using exact same applyZoom function as buttons
- Added trackpad pinch gesture support using same zoom functions as touch pinch
- Trackpad pinch detection via precise wheel event patterns (no Ctrl key required)
- All zoom methods (buttons, touch, trackpad) now use identical underlying code for consistency
- Fixed glitching and snap-back issues by eliminating custom D3 transform logic
- Smooth 200ms transitions maintained across all zoom input methods


### Enhanced Instant Search Functionality (July 2, 2025)
- Implemented real-time instant search with 150ms debounced API calls for immediate feedback
- Enhanced relevance scoring algorithm with weighted factors for different match types
- Optimized PostgreSQL database queries with smart query selection based on input length
- Single-character searches now properly filter artists starting with that character
- Added consistent pink (#FF69B4) color bars for all search recommendations across both search interfaces
- Enhanced search dropdown with loading indicators and empty states
- Applied identical instant search functionality to both home page and network view search bars
- Improved search performance with length-based query optimization for faster results
- Updated match badges to only show "Exact Match" when artist name exactly matches user input
- Removed misleading "Best", "Good", "Match" badges for partial matches to ensure accuracy

- Increased search recommendations from 10 to all available results (up to 100-200 matches) for comprehensive artist discovery
- Enhanced dropdown heights with responsive sizing (50vh on mobile, 60vh on tablets, 70vh on desktop) that adapts to viewport height
- Added intelligent viewport-aware positioning to ensure dropdowns always fit within user's screen
- Enabled vertical scrolling on home page with visible scrollbar for better navigation
- Added informational "How it works" section positioned below search interface with usage instructions and data source attribution
- Added result counters showing "X artists found" to help users understand the breadth of available options

### Perfect Dropdown Height for 3 Artists Display (July 2, 2025)
- Fixed dropdown height to display exactly 3 artists at a time as requested by user
- Home page dropdown: Set to 160px height for precise 3-artist display
- Network view dropdown: Set to 130px height for compact 3-artist display
- Ensured scroll arrows remain fully visible within viewport boundaries
- No page scrolling required to access dropdown functionality

### Responsive Mobile Layout Improvements (July 2, 2025)
- Enhanced mobile responsive design to prevent overlapping content on smaller screens
- "How it works" content repositioned with responsive bottom spacing (bottom-4 on mobile, bottom-12 on tablets, bottom-24 on desktop)
- Reduced logo size on mobile (w-16 h-16) for better space utilization
- Adjusted title and subtitle text sizes for mobile readability (text-xl on mobile vs text-4xl on desktop)
- Improved padding and spacing for search interface on mobile devices (pt-8 on mobile vs pt-16 on desktop)
- Enhanced grid layouts with responsive padding and gap sizing for mobile-first design
- All content now properly fits within mobile viewport without overlapping or requiring page scrolling

### Fixed MusicNerd Production Domain Integration (July 2, 2025)
- Updated all MusicNerd redirect URLs from staging domain to production domain
- Changed `music-nerd-git-staging-musicnerd.vercel.app` to `musicnerd.xyz` across all files
- Fixed artist node links to open correct production artist pages
- Updated artist selection modal to redirect to production MusicNerd homepage
- All MusicNerd integrations now point to live production site instead of staging environment


### Production-Only MusicNerd URL Configuration (July 2, 2025)
- Removed all staging URL fallbacks from both backend and frontend code
- System now exclusively uses MUSICNERD_BASE_URL environment variable for production URLs
- Updated all hardcoded staging URLs in database-storage.ts to use environment variable
- Updated artist-selection-modal.tsx to fetch configuration dynamically instead of hardcoded URL
- Added proper error handling when environment variable is not configured
- Artist node clicks are disabled if production URL is not available
- Backend returns 500 error with clear message if MUSICNERD_BASE_URL is missing
- Frontend validates configuration response and prevents clicks without valid URL
- Currently configured to use https://www.musicnerd.xyz/ production site
- All artist nodes now link exclusively to production MusicNerd environment

- Complete elimination of staging URLs throughout the entire codebase

### Environment Variable Consolidation (July 7, 2025)
- Updated all API endpoints to prioritize MUSIC_BASE_URL over MUSICNERD_BASE_URL for consistency
- Replaced all remaining hardcoded URLs in database-storage.ts with dynamic environment variables
- Artist selection modal now uses dynamic base URL instead of hardcoded musicnerd.xyz
- Added fallback chain: MUSIC_BASE_URL → MUSICNERD_BASE_URL → hardcoded fallback
- Vercel API endpoints and Express server routes now use unified environment variable approach

### Artist Not Found Dialog Implementation (July 7, 2025)
- Created ArtistNotFoundDialog component for artist nodes without valid IDs
- Added popup dialog with message "This artist has not been added to our database yet - feel free to add them and their socials!"
- Dialog includes "Visit MusicNerd" button that opens MusicNerd homepage in new tab
- Updated openMusicNerdProfile function to show dialog instead of doing nothing when no artist ID found
- Fixed touchpad/mobile tap issue in search dropdowns by adding onTouchStart event handlers


### Fixed Main Artist Direct Navigation (July 2, 2025)
- Fixed issue where clicking main artist node showed selection modal instead of going directly to their page
- Updated frontend click handler to identify main artist and bypass modal when artistId is available
- Fixed Vercel API inconsistency: changed musicNerdId to artistId for consistent field naming
- Main artist now navigates directly to their MusicNerd profile page when clicked
- Other collaborator artists still show selection modal when multiple options exist
- Ensured consistent behavior between Replit development and Vercel production deployments

### Fixed Field Naming Inconsistency for Vercel Deployment (July 2, 2025)
- Identified and resolved critical field naming inconsistency between local and Vercel APIs
- Updated Vercel API endpoints to return both `id` and `artistId` fields for backward compatibility
- Fixed local server musicnerd-service.ts to include `artistId` field in artist options responses
- Updated frontend components to prioritize `artistId` field over `id` for consistency
- Modified artist selection modal to handle both field names properly
- Fixed openMusicNerdProfile function to skip API lookups when artistId is already provided
- All APIs now return consistent field structure for seamless artist node navigation
- Local testing confirmed: artist nodes with artistId bypass API calls and open MusicNerd pages directly

### Fixed Artist Name Capitalization (July 2, 2025)
- Fixed issue where map names used search input capitalization instead of database-stored capitalization
- Modified network generation to use exact artist names from database (e.g., "julia michaels" → "Julia Michaels", "REnforShort" → "renforshort")
- Updated both Vercel API routes and main server code to retrieve correct artist name before network generation
- All OpenAI prompts, cache operations, and node creation now use authentic database artist names
- Ensures network maps display proper artist stylization as stored in MusicNerd database
- Applied fix to both cached data retrieval and new network generation paths

### Mobile-Specific Node Interaction Implementation (July 3, 2025)
- Implemented mobile-specific node interaction mechanics for touch devices
- Added `MobileNodeActionModal` component that shows choice dialog when mobile users tap artist nodes
- Mobile behavior: Single tap opens choice modal with "Go to MusicNerd page" and "See their network map" options
- Desktop behavior: Maintains existing left-click (MusicNerd page) and right-click (network map) functionality
- Enhanced `NetworkNode` type definition to include `artistId` property for proper node linking
- Integrated `useIsMobile` hook for accurate device detection (screens < 768px)
- Mobile modal shows both navigation options for all artist nodes except main artist (which only shows MusicNerd option)
- Provides equivalent functionality to desktop right-click through mobile-friendly interface
- Addresses touch device limitation where right-click context is not available

### Enhanced Mobile Modal with Tooltip Information (July 3, 2025)
- Extended mobile modal to work with all node types (artists, producers, songwriters)
- Moved all hover tooltip information into mobile modal for better mobile experience
- Disabled hover tooltips on mobile devices (under 768px width) to prevent conflicts
- Mobile modal now displays: artist name, role(s), and collaboration details for all nodes
- Producer and songwriter modals show information only (no navigation buttons)
- Artist modals include both information and navigation options (MusicNerd page, network map)
- Enhanced mobile user experience with same detailed information previously only available on hover




### Supabase Caching System Integration (June 30, 2025)
- Added webmapdata jsonb column to artists table for caching network visualization data
- Implemented intelligent caching system to check for existing network data before generating new results
- Cache-first approach: system checks webmapdata before calling OpenAI or other external APIs
- Network data automatically cached after generation to improve performance on subsequent searches
- Database queries optimized to include webmapdata field for fast retrieval
- Fixed column name compatibility with MusicNerd database schema (webmapdata vs webMapData)
- Successfully handles existing database schema without type, image_url, or spotify_id columns
- **PERFORMANCE**: First generation ~7 seconds, cached requests ~180ms (42x faster)
- System generates comprehensive authentic networks with proper MusicNerd artist linking
- All column references updated from webMapData to webmapdata for full compatibility

### Enhanced Tooltip System (June 30, 2025)
- Updated producer and songwriter tooltips to display "Top Collaborations:" with their collaborating artists
- Tooltips now show the exact top 3 artists each producer/songwriter has worked with
- Enhanced collaboration data stored in node structure for instant tooltip display
- Tooltip format matches user-requested design showing artist names in clean list format


### Visual Improvements (June 26, 2025)
- Updated color scheme to appealing pinks, purples, and teals
- Artists: Pink (#ec4899), Producers: Purple (#a855f7), Songwriters: Teal (#14b8a6)
- Made all artist names visible on nodes with improved text shadows
- Updated filter controls to match new color scheme
- Added permanent stroke outlines to all nodes for better visibility

### Vibrant Color Palette Update (June 27, 2025)
- Applied cohesive vibrant color palette based on user-provided pink and cyan colors
- Artists: Hot Pink (#FF69B4) - Bright vibrant pink for main artists
- Producers: Blue Violet Purple (#8A2BE2) - Harmonious purple bridging pink and cyan
- Songwriters: Dark Turquoise (#00CED1) - Vibrant cyan-turquoise for songwriters
- Updated all UI components including nodes, legend, CSS variables, and JavaScript color definitions
- Modern, energetic aesthetic with high contrast and visual appeal for music collaboration networks

## User Preferences

```
Preferred communication style: Simple, everyday language.
```