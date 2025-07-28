import { Loader2, Network, Users, Database } from "lucide-react";

interface ExpandNetworkLoadingProps {
  isVisible: boolean;
  artistName?: string;
}

export default function ExpandNetworkLoading({ isVisible, artistName }: ExpandNetworkLoadingProps) {
  if (!isVisible) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50 p-4">
      <div className="bg-black/90 rounded-xl p-6 sm:p-8 flex flex-col items-center space-y-4 sm:space-y-6 max-w-sm sm:max-w-md border border-pink-500/20 shadow-2xl">
        {/* Main Loading Spinner */}
        <div className="relative">
          <Loader2 className="h-12 w-12 sm:h-16 sm:w-16 animate-spin text-pink-500" />
          <div className="absolute inset-0 rounded-full border-2 border-pink-500/30 animate-pulse"></div>
        </div>

        {/* Loading Text */}
        <div className="text-center space-y-2">
          <h3 className="text-lg sm:text-xl font-semibold text-white">
            {artistName ? `Expanding ${artistName}'s Network` : "Expanding Network"}
          </h3>
          <p className="text-sm sm:text-base text-gray-300">
            Fetching collaboration data and merging networks...
          </p>
        </div>

        {/* Progress Indicators */}
        <div className="flex items-center justify-center space-x-4 text-xs text-gray-400">
          <div className="flex items-center space-x-1">
            <Network className="h-3 w-3 text-pink-500" />
            <span>Network</span>
          </div>
          <div className="flex items-center space-x-1">
            <Users className="h-3 w-3 text-pink-500" />
            <span>Collaborators</span>
          </div>
          <div className="flex items-center space-x-1">
            <Database className="h-3 w-3 text-pink-500" />
            <span>Merging</span>
          </div>
        </div>

        {/* Animated Dots */}
        <div className="flex space-x-1">
          <div className="w-2 h-2 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-2 h-2 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-2 h-2 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>

        {/* Additional Info */}
        <div className="text-xs text-gray-500 text-center max-w-xs">
          Adding new collaborators and connections to your network view
        </div>
      </div>
    </div>
  );
} 