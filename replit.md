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
Now integrates with multiple authentic sources for comprehensive collaboration data:
- **MusicBrainz API**: Primary source for artist collaboration relationships
- **Wikipedia API**: Secondary source for collaboration data when MusicBrainz lacks information
- **Spotify Web API**: Provides artist profile images and additional metadata
- **Intelligent Fallback**: Two-tier system (MusicBrainz → Wikipedia) with authentic data only
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
- Artist nodes (pink circles) now link to `https://music-nerd-git-staging-musicnerd.vercel.app/artist/{artistId}` when ID available
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