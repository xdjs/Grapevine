# Music Collaboration Network Visualizer

An interactive web application that visualizes music collaboration networks between artists, producers, and songwriters using authentic industry data from multiple sources.

![Music Collaboration Network](https://img.shields.io/badge/React-18-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![D3.js](https://img.shields.io/badge/D3.js-7-orange) ![Express](https://img.shields.io/badge/Express-4-green)

## 🎵 Features

- **Interactive Network Visualization**: Explore artist relationships through an intuitive D3.js-powered network graph
- **Authentic Data Sources**: Real collaboration data from MusicBrainz API and Wikipedia
- **Dynamic Search**: Search any artist and instantly generate their collaboration network
- **Advanced Filtering**: Filter by artist type (artists, producers, songwriters)
- **Zoom & Pan Controls**: Smooth navigation with zoom in/out/reset functionality
- **Real-time Data**: Live integration with music databases for up-to-date information
- **Responsive Design**: Works seamlessly across desktop and mobile devices

## 🚀 Demo

Search for any artist like "Taylor Swift", "Drake", or "Billie Eilish" to see their collaboration networks come to life!

## 🛠 Tech Stack

### Frontend
- **React 18** with TypeScript
- **D3.js** for network visualization
- **Tailwind CSS** with shadcn/ui components
- **TanStack Query** for state management
- **Wouter** for routing
- **Vite** for build tooling

### Backend
- **Node.js** with Express.js
- **TypeScript** throughout
- **Drizzle ORM** with PostgreSQL support
- **Multiple API integrations**: MusicBrainz, Wikipedia, Spotify

### Data Sources
- **MusicBrainz API**: Primary source for artist collaboration data
- **Wikipedia API**: Secondary source for additional collaboration information
- **Spotify Web API**: Artist images and metadata (optional)

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd music-collaboration-network
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables (optional)**
   ```bash
   cp .env.example .env
   ```
   Add your API keys:
   ```
   DATABASE_URL=your_database_url
   SPOTIFY_CLIENT_ID=your_spotify_client_id
   SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to `http://localhost:5000`

## 🎯 Usage

1. **Search for an Artist**: Enter any artist name in the search bar
2. **Explore the Network**: Click and drag to pan, use mouse wheel to zoom
3. **Filter Results**: Use the filter controls to show/hide different types of collaborators
4. **Zoom Controls**: Use the zoom buttons for precise navigation
5. **View Details**: Hover over nodes to see artist information
6. **Clear Network**: Use the "Clear All" button to reset the visualization

## 🏗 Project Structure

```
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/         # Page components
│   │   ├── lib/           # Utility functions
│   │   └── types/         # TypeScript definitions
├── server/                # Backend Express server
│   ├── routes.ts          # API routes
│   ├── storage.ts         # Data storage interface
│   ├── musicbrainz.ts     # MusicBrainz API integration
│   ├── wikipedia.ts       # Wikipedia API integration
│   └── spotify.ts         # Spotify API integration
├── shared/                # Shared TypeScript schemas
└── package.json           # Project dependencies
```

## 🎨 Color Scheme

The application uses a vibrant, music-inspired color palette:
- **Artists**: Hot Pink (#FF69B4)
- **Producers**: Blue Violet Purple (#8A2BE2)
- **Songwriters**: Dark Turquoise (#00CED1)

## 🔧 API Integration

### MusicBrainz API
- Primary source for authentic collaboration data
- Rate-limited requests for sustainable usage
- Comprehensive relationship mapping

### Wikipedia API
- Secondary data source for additional context
- Natural language processing for collaboration extraction
- Fallback when MusicBrainz lacks information

### Spotify Web API (Optional)
- Artist profile images and metadata
- Enhanced visual presentation
- Requires API credentials

## 🚀 Deployment

### Build for Production
```bash
npm run build
npm run start
```

### Deploy to Vercel
```bash
npm install -g vercel
vercel
```

### Deploy to Railway
```bash
npm install -g @railway/cli
railway login
railway deploy
```

## 📊 Data Authenticity

This application prioritizes authentic music industry data:
- **No synthetic data**: Only real collaborations from verified sources
- **Two-tier fallback**: MusicBrainz → Wikipedia (no generated fallbacks)
- **Single artist display**: When no collaboration data exists, shows only the searched artist
- **Comprehensive debugging**: Detailed logging of data sources and extraction processes

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **MusicBrainz** for providing comprehensive music relationship data
- **Wikipedia** for additional collaboration context
- **Spotify** for artist images and metadata
- **D3.js** community for visualization inspiration
- **React** and **TypeScript** teams for excellent development tools

## 📞 Support

If you encounter any issues or have questions:
1. Check the [Issues](../../issues) section
2. Create a new issue if your problem isn't listed
3. Provide detailed information about your environment and the issue

---

**Built with ❤️ for the music community**
