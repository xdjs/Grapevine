import { render, screen, fireEvent } from '@testing-library/react';
import MobileControls from './mobile-controls';

// Mock the useIsMobile hook
vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => true
}));

// Mock the useToast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}));

describe('MobileControls', () => {
  const mockProps = {
    onZoomIn: vi.fn(),
    onZoomOut: vi.fn(),
    onZoomReset: vi.fn(),
    onClearAll: vi.fn(),
    artistId: '123'
  };

  it('should render the options menu button when not showing menu', () => {
    render(<MobileControls {...mockProps} />);
    
    const optionsButton = screen.getByTitle('Options');
    expect(optionsButton).toBeInTheDocument();
  });

  it('should show menu when options button is clicked', () => {
    render(<MobileControls {...mockProps} />);
    
    const optionsButton = screen.getByTitle('Options');
    fireEvent.click(optionsButton);
    
    expect(screen.getByTitle('Share')).toBeInTheDocument();
    expect(screen.getByTitle('Settings')).toBeInTheDocument();
    expect(screen.getByTitle('Help')).toBeInTheDocument();
    expect(screen.getByTitle('Close Menu')).toBeInTheDocument();
  });

  it('should show reset button when onBackToFirstDegree is provided', () => {
    const mockResetFunction = vi.fn();
    render(<MobileControls {...mockProps} onBackToFirstDegree={mockResetFunction} />);
    
    // Open the menu
    const optionsButton = screen.getByTitle('Options');
    fireEvent.click(optionsButton);
    
    // Check that reset button is present
    const resetButton = screen.getByTitle('Back to First Degree');
    expect(resetButton).toBeInTheDocument();
    
    // Test that clicking the button calls the reset function
    fireEvent.click(resetButton);
    expect(mockResetFunction).toHaveBeenCalledTimes(1);
  });

  it('should not show reset button when onBackToFirstDegree is not provided', () => {
    render(<MobileControls {...mockProps} />);
    
    // Open the menu
    const optionsButton = screen.getByTitle('Options');
    fireEvent.click(optionsButton);
    
    // Check that reset button is not present
    expect(screen.queryByTitle('Back to First Degree')).not.toBeInTheDocument();
  });

  it('should have correct styling for reset button', () => {
    const mockResetFunction = vi.fn();
    render(<MobileControls {...mockProps} onBackToFirstDegree={mockResetFunction} />);
    
    // Open the menu
    const optionsButton = screen.getByTitle('Options');
    fireEvent.click(optionsButton);
    
    const resetButton = screen.getByTitle('Back to First Degree');
    expect(resetButton).toHaveStyle({
      backgroundColor: '#F2A6E0',
      borderColor: '#F2A6E0'
    });
  });

  it('should call zoom functions when zoom buttons are clicked', () => {
    render(<MobileControls {...mockProps} />);
    
    // Open the menu
    const optionsButton = screen.getByTitle('Options');
    fireEvent.click(optionsButton);
    
    // Open settings panel
    const settingsButton = screen.getByTitle('Settings');
    fireEvent.click(settingsButton);
    
    // Test zoom buttons
    const zoomInButton = screen.getByText('In');
    const zoomOutButton = screen.getByText('Out');
    const zoomResetButton = screen.getByText('Reset');
    
    fireEvent.click(zoomInButton);
    expect(mockProps.onZoomIn).toHaveBeenCalledTimes(1);
    
    fireEvent.click(zoomOutButton);
    expect(mockProps.onZoomOut).toHaveBeenCalledTimes(1);
    
    fireEvent.click(zoomResetButton);
    expect(mockProps.onZoomReset).toHaveBeenCalledTimes(1);
  });
});
