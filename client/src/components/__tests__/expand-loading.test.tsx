import { render, screen } from '@testing-library/react';
import ExpandLoading from '@/components/expand-loading';

describe('ExpandLoading overlay', () => {
  it('renders with fixed positioning and does not capture pointer events', () => {
    render(<ExpandLoading isVisible={true} artistName="Test Artist" />);

    const overlay = screen.getByText('Expanding Network').parentElement?.parentElement as HTMLElement;
    expect(overlay).toBeTruthy();
    const className = overlay.className;
    expect(className).toContain('fixed');
    expect(className).toContain('pointer-events-none');
  });

  it('does not render when not visible', () => {
    const { queryByText } = render(<ExpandLoading isVisible={false} artistName="X" />);
    expect(queryByText('Expanding Network')).toBeNull();
  });
});


