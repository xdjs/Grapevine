# Grapevine Codebase Summary

## 🎵 Project Overview

**Grapevine** is an interactive web application that visualizes music collaboration networks between artists, producers, and songwriters using authentic industry data from multiple sources. The application allows users to search for any artist and explore their collaboration relationships through an intuitive D3.js-powered network graph.

## 🏗️ Architecture & Tech Stack

### Frontend (Client)
- **Framework**: React 18 with TypeScript
- **Visualization**: D3.js v7 for interactive network graphs
- **Styling**: Tailwind CSS with shadcn/ui component library
- **State Management**: TanStack Query (React Query) for server state
- **Routing**: Wouter for lightweight client-side routing
- **Build Tool**: Vite for fast development and optimized builds

### Backend (Server)
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript throughout the entire stack
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Session Management**: Express sessions with PostgreSQL storage
- **API Integration**: Multiple external APIs (MusicBrainz, Wikipedia, Spotify)

### Deployment & Infrastructure
- **Platform**: Vercel for serverless deployment
- **Database**: Supabase/Neon for managed PostgreSQL
- **Environment**: Node.js 18+ with npm 8+

## 📁 Project Structure

```
Grapevine/
├── client/                     # React frontend application
│   ├── src/
│   │   ├── components/         # React components (includes 1467-line NetworkVisualizer)
│   │   ├── pages/             # Page-level components (Home, ArtistNetwork, NotFound)
│   │   ├── lib/               # Utility functions and shared logic
│   │   ├── hooks/             # Custom React hooks
│   │   ├── types/             # TypeScript type definitions
│   │   └── assets/            # Static assets and images
│   ├── public/                # Public static files
│   └── index.html             # HTML entry point
├── server/                    # Express.js backend
│   ├── index.ts              # Server entry point with middleware
│   ├── routes.ts             # API route definitions and handlers
│   ├── musicbrainz.ts        # MusicBrainz API integration
│   ├── wikipedia.ts          # Wikipedia API integration
│   ├── spotify.ts            # Spotify Web API integration
│   ├── storage.ts            # Database operations and caching
│   └── env.ts                # Environment configuration
├── api/                      # Vercel serverless functions
│   ├── network/              # Network data endpoints
│   ├── search.ts             # Artist search functionality
│   ├── artist-options/       # Artist disambiguation
│   └── collaboration-details/ # Collaboration details
├── shared/                   # Shared TypeScript schemas and types
│   └── schema.ts             # Drizzle database schema and Zod validations
├── plans/                    # Project planning and documentation
│   └── NETWORK_VISUALIZER_REFACTOR_PLAN.md
└── package.json              # Project dependencies and scripts
```

## 🔗 Data Sources & APIs

### Primary Data Sources
1. **MusicBrainz API** - Primary source for authentic collaboration data
   - Comprehensive music relationship database
   - Rate-limited requests for sustainable usage
   - Artist-artist relationships (producer, songwriter, performer)

2. **Wikipedia API** - Secondary source for additional context
   - Natural language processing for collaboration extraction
   - Fallback when MusicBrainz lacks information
   - Contextual information about artist relationships

3. **Spotify Web API** (Optional) - Enhanced metadata
   - Artist profile images and high-quality artwork
   - Additional metadata for visual presentation
   - Requires API credentials for full functionality

### Data Integration Strategy
- **Two-tier fallback system**: MusicBrainz → Wikipedia (no synthetic data)
- **Authentic data priority**: Only real collaborations from verified sources
- **Comprehensive caching**: Database storage for frequently accessed networks
- **Single artist display**: When no collaborations exist, shows only the searched artist

## 🎨 Core Features

### Network Visualization
- **Interactive D3.js graphs** with smooth animations and transitions
- **Multi-role support** for artists who are also producers/songwriters
- **Dynamic node sizing** based on collaboration count and artist prominence
- **Color-coded relationships**: Artists (Hot Pink), Producers (Purple), Songwriters (Turquoise)

### User Interactions
- **Real-time search** with instant artist suggestions and disambiguation
- **Zoom and pan controls** with mouse wheel and touch gesture support
- **Advanced filtering** to show/hide different types of collaborators
- **Collaboration details** popup with song/album information
- **Search history** with session-based persistence

### Mobile Optimization
- **Responsive design** that works across desktop and mobile devices
- **Touch gesture support** for pinch-to-zoom and pan navigation
- **Adaptive UI** with different layouts for various screen sizes
- **Performance optimization** for mobile browsers

## 🗄️ Database Schema

### Core Tables
```sql
-- Artists table (musicians, producers, songwriters)
artists {
  id: serial (primary key)
  name: text (unique, not null)
  type: text (artist/producer/songwriter)
  imageUrl: text (profile picture URL)
  spotifyId: text (Spotify artist ID)
  webmapdata: jsonb (cached network data)
  x: text (Twitter/X username)
  instagramUsername: text
  facebookUsername: text
}

-- Collaborations table (relationships between artists)
collaborations {
  id: serial (primary key)
  fromArtistId: integer (references artists.id)
  toArtistId: integer (references artists.id)
  collaborationType: text (production/songwriting)
}
```

### Data Types & Validation
- **Zod schemas** for runtime type validation
- **Drizzle ORM** for type-safe database operations
- **Shared types** between frontend and backend for consistency

## 🔧 Key Components

### Major Frontend Components
1. **NetworkVisualizer** (1467 lines - NEEDS REFACTORING)
   - Complex D3.js integration for graph rendering
   - Touch and zoom event handling
   - Node interaction and tooltip management
   - Multi-role visualization logic

2. **SearchInterface** (1023 lines)
   - Artist search with real-time suggestions
   - Search history management
   - Mobile-responsive design with dynamic spacing

3. **MobileControls** (859 lines)
   - Mobile-optimized zoom and filter controls
   - Touch-friendly interface elements

### Backend Services
1. **MusicBrainz Integration** - Primary data fetching and relationship mapping
2. **Wikipedia Integration** - Secondary data source with NLP processing
3. **Spotify Integration** - Artist images and metadata enhancement
4. **Caching System** - Database-backed caching for network data

## 🚨 Current Technical Debt

### Immediate Refactoring Needs
1. **NetworkVisualizer Component** (Priority: HIGH)
   - 1467 lines in single file with mixed concerns
   - Complex D3 logic intertwined with React state management
   - Detailed refactoring plan exists in `plans/NETWORK_VISUALIZER_REFACTOR_PLAN.md`
   - Should be broken into 10+ focused components

2. **SearchInterface Optimization** (Priority: MEDIUM)
   - 1023 lines with multiple responsibilities
   - Mobile responsive logic could be extracted
   - History management could be a separate hook

3. **Code Organization** (Priority: MEDIUM)
   - Some components lack proper separation of concerns
   - Utility functions could be better organized
   - Missing comprehensive test coverage

## 🧪 Testing Infrastructure

### Current State
- **Basic setup**: Jest for test runner, React Testing Library for component testing
- **Limited coverage**: Only `loading-screen.test.tsx` exists currently
- **Established patterns**: Clear testing conventions in existing test file

### Testing Needs
- Unit tests for utility functions (D3 handlers, data processing)
- Component tests for major UI components
- Integration tests for API endpoints
- End-to-end tests for user workflows

## 🚀 Development Workflow

### Available Scripts
```json
{
  "dev": "Full development server with hot reload",
  "dev:client": "Frontend development server only",
  "dev:api": "API development server only", 
  "build": "Production build for both client and server",
  "db:push": "Push database schema changes",
  "db:studio": "Open Drizzle database studio",
  "lint": "ESLint with auto-fix",
  "check": "TypeScript type checking"
}
```

### Environment Setup
- Requires Node.js 18+ and npm 8+
- Optional environment variables for API integrations
- Database URL configuration for PostgreSQL

## 📊 Performance Considerations

### Optimization Strategies
- **Data caching** in PostgreSQL for frequently accessed networks
- **Lazy loading** of artist profile images
- **Rate limiting** for external API calls
- **Database connection pooling** for scalability

### Mobile Performance
- **Touch event optimization** with manual gesture handling
- **Responsive design** with viewport-specific layouts
- **Image optimization** with proper aspect ratios and fallbacks

## 🔮 Planned Improvements

### Near Term (Based on Existing Plans)
1. **NetworkVisualizer Refactoring** - Break into modular components
2. **Enhanced Testing** - Comprehensive test coverage
3. **Performance Optimization** - Mobile performance improvements
4. **Component Organization** - Better separation of concerns

### Future Enhancements
- **Social media integration** for artist profiles
- **Enhanced collaboration details** with song/album information
- **User preferences** for visualization settings
- **Export functionality** for network graphs

## 💡 Notable Technical Decisions

### Architecture Choices
- **Monorepo structure** for better code sharing between client/server
- **TypeScript everywhere** for type safety and developer experience
- **Serverless deployment** on Vercel for scalability and cost optimization
- **PostgreSQL over NoSQL** for complex relationship queries

### Library Selections
- **D3.js over other visualization libraries** for maximum flexibility and performance
- **Drizzle ORM over Prisma** for better TypeScript integration
- **Wouter over React Router** for smaller bundle size
- **shadcn/ui over other component libraries** for customization and design consistency

## 🏁 Summary

Grapevine is a well-architected music collaboration visualization platform with a solid foundation in modern web technologies. The codebase demonstrates good practices in TypeScript usage, API integration, and data authenticity. However, it currently suffers from some monolithic components (particularly NetworkVisualizer) that need refactoring for better maintainability and testability.

The application successfully balances performance, user experience, and data authenticity, making it a valuable tool for exploring music industry collaboration networks. With the planned refactoring and continued development, it has strong potential for growth and feature expansion.

**Key Strengths:**
- Authentic data sources with proper fallback strategies
- Modern, performant tech stack
- Mobile-optimized responsive design
- Type-safe architecture throughout

**Areas for Improvement:**
- Component refactoring (detailed plan exists)
- Test coverage expansion
- Performance optimization for large networks
- Enhanced mobile interaction patterns
