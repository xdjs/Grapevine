import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import MobileDraggableZoomControls from './mobile-draggable-zoom-controls';

// Mock the useIsMobile hook
vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => true
}));

describe('MobileDraggableZoomControls', () => {
  const mockProps = {
    onZoomIn: vi.fn(),
    onZoomOut: vi.fn(),
    onZoomReset: vi.fn(),
    onClearAll: vi.fn(),
    onBackToFirstDegree: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders zoom controls', () => {
    render(<MobileDraggableZoomControls {...mockProps} />);
    
    expect(screen.getByText('Zoom')).toBeInTheDocument();
    expect(screen.getByText('In')).toBeInTheDocument();
    expect(screen.getByText('Out')).toBeInTheDocument();
    expect(screen.getByText('Reset')).toBeInTheDocument();
  });

  it('renders clear all button by default', () => {
    render(<MobileDraggableZoomControls {...mockProps} />);
    
    expect(screen.getByText('Clear All')).toBeInTheDocument();
  });

  it('renders back to first degree button when enabled', () => {
    render(
      <MobileDraggableZoomControls 
        {...mockProps} 
        showBackToFirstDegree={true}
      />
    );
    
    expect(screen.getByText('Back to First Degree')).toBeInTheDocument();
  });

  it('calls onZoomIn when zoom in button is clicked', () => {
    render(<MobileDraggableZoomControls {...mockProps} />);
    
    fireEvent.click(screen.getByText('In'));
    expect(mockProps.onZoomIn).toHaveBeenCalledTimes(1);
  });

  it('calls onZoomOut when zoom out button is clicked', () => {
    render(<MobileDraggableZoomControls {...mockProps} />);
    
    fireEvent.click(screen.getByText('Out'));
    expect(mockProps.onZoomOut).toHaveBeenCalledTimes(1);
  });

  it('calls onZoomReset when zoom reset button is clicked', () => {
    render(<MobileDraggableZoomControls {...mockProps} />);
    
    fireEvent.click(screen.getByText('Reset'));
    expect(mockProps.onZoomReset).toHaveBeenCalledTimes(1);
  });

  it('calls onClearAll when clear all button is clicked', () => {
    render(<MobileDraggableZoomControls {...mockProps} />);
    
    fireEvent.click(screen.getByText('Clear All'));
    expect(mockProps.onClearAll).toHaveBeenCalledTimes(1);
  });

  it('calls onBackToFirstDegree when back to first degree button is clicked', () => {
    render(
      <MobileDraggableZoomControls 
        {...mockProps} 
        showBackToFirstDegree={true}
      />
    );
    
    fireEvent.click(screen.getByText('Back to First Degree'));
    expect(mockProps.onBackToFirstDegree).toHaveBeenCalledTimes(1);
  });

  it('shows drag handle with instructions', () => {
    render(<MobileDraggableZoomControls {...mockProps} />);
    
    expect(screen.getByText('Drag to move')).toBeInTheDocument();
  });

  it('can be disabled', () => {
    render(<MobileDraggableZoomControls {...mockProps} disabled={true} />);
    
    const buttons = screen.getAllByRole('button');
    buttons.forEach(button => {
      expect(button).toBeDisabled();
    });
  });
});
