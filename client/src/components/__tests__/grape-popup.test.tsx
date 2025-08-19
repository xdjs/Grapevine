import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import GrapePopup from '../grape-popup';

describe('GrapePopup', () => {
  const mockOnClose = vi.fn();
  const mockGrapeData = {
    linkIndex: 0,
    clusterIndex: 1,
    grapeIndex: 2,
    sourceArtist: 'Taylor Swift',
    targetArtist: 'Jack Antonoff'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not render when isOpen is false', () => {
    render(
      <GrapePopup
        isOpen={false}
        onClose={mockOnClose}
        grapeData={mockGrapeData}
      />
    );

    expect(screen.queryByText('Grape Details')).not.toBeInTheDocument();
  });

  it('should render when isOpen is true', () => {
    render(
      <GrapePopup
        isOpen={true}
        onClose={mockOnClose}
        grapeData={mockGrapeData}
      />
    );

    expect(screen.getByText('Grape Details')).toBeInTheDocument();
    expect(screen.getByText('Grape popup content will go here.')).toBeInTheDocument();
  });

  it('should display grape data when provided', () => {
    render(
      <GrapePopup
        isOpen={true}
        onClose={mockOnClose}
        grapeData={mockGrapeData}
      />
    );

    expect(screen.getByText('Link: Taylor Swift → Jack Antonoff')).toBeInTheDocument();
    expect(screen.getByText('Cluster: 1, Grape: 2')).toBeInTheDocument();
  });

  it('should not display grape data when not provided', () => {
    render(
      <GrapePopup
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    expect(screen.queryByText(/Link:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Cluster:/)).not.toBeInTheDocument();
  });

  it('should call onClose when X button is clicked', () => {
    render(
      <GrapePopup
        isOpen={true}
        onClose={mockOnClose}
        grapeData={mockGrapeData}
      />
    );

    const closeButton = screen.getByLabelText('Close popup');
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should call onClose when overlay is clicked', () => {
    render(
      <GrapePopup
        isOpen={true}
        onClose={mockOnClose}
        grapeData={mockGrapeData}
      />
    );

    const overlay = screen.getByTestId('overlay');
    fireEvent.click(overlay);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should not call onClose when content is clicked', () => {
    render(
      <GrapePopup
        isOpen={true}
        onClose={mockOnClose}
        grapeData={mockGrapeData}
      />
    );

    const content = screen.getByText('Grape Details').closest('div');
    if (content) {
      fireEvent.click(content);
    }

    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('should call onClose when Escape key is pressed', async () => {
    render(
      <GrapePopup
        isOpen={true}
        onClose={mockOnClose}
        grapeData={mockGrapeData}
      />
    );

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  it('should not call onClose when other keys are pressed', () => {
    render(
      <GrapePopup
        isOpen={true}
        onClose={mockOnClose}
        grapeData={mockGrapeData}
      />
    );

    fireEvent.keyDown(document, { key: 'Enter' });
    fireEvent.keyDown(document, { key: 'Space' });
    fireEvent.keyDown(document, { key: 'Tab' });

    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('should have proper accessibility attributes', () => {
    render(
      <GrapePopup
        isOpen={true}
        onClose={mockOnClose}
        grapeData={mockGrapeData}
      />
    );

    const closeButton = screen.getByLabelText('Close popup');
    expect(closeButton).toBeInTheDocument();
    expect(closeButton).toHaveAttribute('aria-label', 'Close popup');
  });

  it('should have proper styling classes', () => {
    render(
      <GrapePopup
        isOpen={true}
        onClose={mockOnClose}
        grapeData={mockGrapeData}
      />
    );

    const popup = screen.getByTestId('popup-content');
    expect(popup).toHaveClass('bg-black/95', 'backdrop-blur-sm', 'border-2', 'border-purple-500/30', 'rounded-xl', 'shadow-2xl');
  });

  it('should handle multiple rapid close attempts gracefully', () => {
    render(
      <GrapePopup
        isOpen={true}
        onClose={mockOnClose}
        grapeData={mockGrapeData}
      />
    );

    const closeButton = screen.getByLabelText('Close popup');
    
    // Click multiple times rapidly
    fireEvent.click(closeButton);
    fireEvent.click(closeButton);
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(3);
  });

  it('should clean up event listeners when unmounted', () => {
    const { unmount } = render(
      <GrapePopup
        isOpen={true}
        onClose={mockOnClose}
        grapeData={mockGrapeData}
      />
    );

    // Spy on removeEventListener
    const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
  });
});
