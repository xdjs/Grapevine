import { render, screen } from '@testing-library/react';
import LoadingScreen from './loading-screen';

describe('LoadingScreen', () => {
  it('renders when visible', () => {
    render(<LoadingScreen isVisible={true} />);
    expect(screen.getByText("Generating Artist Network")).toBeInTheDocument();
    expect(screen.getByText("Data Sources")).toBeInTheDocument();
    expect(screen.getByText("Spotify")).toBeInTheDocument();
    expect(screen.getByText("Collaborations")).toBeInTheDocument();
  });

  it('does not render when not visible', () => {
    render(<LoadingScreen isVisible={false} />);
    expect(screen.queryByText("Generating Artist Network")).not.toBeInTheDocument();
  });

  it('shows artist name when provided', () => {
    render(<LoadingScreen isVisible={true} artistName="Taylor Swift" />);
    expect(screen.getByText("Generating Taylor Swift's Network")).toBeInTheDocument();
  });
}); 