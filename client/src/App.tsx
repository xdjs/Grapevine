import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/home";
import ArtistNetwork from "@/pages/artist-network";
import NotFound from "@/pages/not-found";
import { useViewportHeight } from "@/hooks/use-mobile";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/connections" component={ArtistNetwork} />
      <Route path="/:artistId" component={Home} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useViewportHeight(); // Manage viewport height for mobile devices

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
