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
- **Schema**: Two main tables - artists and collaborations
- **Migrations**: Drizzle Kit for database migrations
- **Connection**: @neondatabase/serverless for serverless PostgreSQL connections

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

### Mock Data Implementation
Currently uses in-memory storage (`MemStorage`) with pre-populated mock data including:
- Taylor Swift collaboration network (Jack Antonoff, Aaron Dessner, etc.)
- Drake collaboration network (40, Boi-1da, Hit-Boy, etc.)
- Cross-artist collaborations to demonstrate network connections

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
- Uses Drizzle migrations stored in `./migrations`
- Schema defined in `shared/schema.ts`
- Environment variable `DATABASE_URL` required for database connection
- `npm run db:push` command available for schema updates

## Changelog

```
Changelog:
- June 26, 2025. Initial setup
- June 26, 2025. Fixed search icon positioning, network accumulation, and zoom functionality
```

## Recent Changes

### Fixed Network Accumulation (June 26, 2025)
- Modified home page to merge new artist data with existing network instead of replacing
- Added proper duplicate detection for nodes and links
- Artists now build up connected webs when searching multiple times

### Fixed UI Issues (June 26, 2025)
- Corrected search icon positioning on both home and connections screens
- Adjusted input padding to prevent text/button overlap
- Added red "Clear All" button to zoom controls for resetting visualization

### Fixed Zoom Controls (June 26, 2025)
- Resolved zoom button functionality with proper event handling
- Zoom in/out/reset controls now work correctly with D3.js visualization
- Added debugging and event listener management

### Unlimited Artist Support (June 26, 2025)
- Added dynamic network generation for any artist name not in mock data
- Implemented smart cluster positioning to prevent networks from going off-screen
- Added boundary forces to keep all nodes within viewport
- Fixed search icon centering in input field
- Networks now appear as separate, unconnected clusters when artists have no common collaborators

### Visual Improvements (June 26, 2025)
- Updated color scheme to appealing pinks, purples, and teals
- Artists: Pink (#ec4899), Producers: Purple (#a855f7), Songwriters: Teal (#14b8a6)
- Made all artist names visible on nodes with improved text shadows
- Updated filter controls to match new color scheme
- Added permanent stroke outlines to all nodes for better visibility

## User Preferences

```
Preferred communication style: Simple, everyday language.
```