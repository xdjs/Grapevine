import { render, screen } from '@testing-library/react';
import LoadingScreen from './loading-screen';

describe('LoadingScreen', () => {
  it('renders when visible', () => {
    render(<LoadingScreen isVisible={true} artistName="Taylor Swift" />);
    
    expect(screen.getByText("Generating Taylor Swift's Network")).toBeInTheDocument();
    expect(screen.getByText("Analyzing collaboration data from multiple sources...")).toBeInTheDocument();
    expect(screen.getByText("MusicBrainz")).toBeInTheDocument();
    expect(screen.getByText("Spotify")).toBeInTheDocument();
    expect(screen.getByText("Collaborations")).toBeInTheDocument();
  });

  it('does not render when not visible', () => {
    render(<LoadingScreen isVisible={false} artistName="Taylor Swift" />);
    
    expect(screen.queryByText("Generating Taylor Swift's Network")).not.toBeInTheDocument();
  });

  it('shows generic text when no artist name provided', () => {
    render(<LoadingScreen isVisible={true} />);
    
    expect(screen.getByText("Generating Artist Network")).toBeInTheDocument();
  });
}); 