# Mobile Draggable Zoom Controls

A mobile-optimized, draggable zoom controls component that allows users to move the zoom controls around the screen on mobile devices.

## Features

### 🎯 **Draggable Interface**
- **Touch & Mouse Support**: Works with both touch gestures and mouse interactions
- **Screen Bounds**: Automatically constrains the controls within the viewport
- **Smooth Dragging**: Visual feedback during drag operations with scaling effects

### 📱 **Mobile-First Design**
- **Responsive Layout**: Optimized for mobile screens with appropriate sizing
- **Touch-Friendly**: Large touch targets for better mobile usability
- **Backdrop Blur**: Modern glassmorphism design that works well on mobile

### 💾 **Persistent State**
- **Position Memory**: Saves the last position in localStorage
- **Collapsed State**: Remembers whether controls are collapsed or expanded
- **Orientation Handling**: Automatically resets position on screen orientation changes

### 🎛️ **Interactive Controls**
- **Collapsible Interface**: Toggle between compact and full view
- **Double-Tap Reset**: Double-tap the drag handle to reset to default position
- **Visual Feedback**: Clear indicators for all interactive elements

## Usage

```tsx
import MobileDraggableZoomControls from './mobile-draggable-zoom-controls';

<MobileDraggableZoomControls
  onZoomIn={handleZoomIn}
  onZoomOut={handleZoomOut}
  onZoomReset={handleZoomReset}
  onBackToFirstDegree={handleResetToFirstDegree}
  onClearAll={handleClearAll}
  showClearButton={true}
  showBackToFirstDegree={true}
  disabled={false}
/>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onZoomIn` | `() => void` | **Required** | Function called when zoom in button is pressed |
| `onZoomOut` | `() => void` | **Required** | Function called when zoom out button is pressed |
| `onZoomReset` | `() => void` | **Required** | Function called when zoom reset button is pressed |
| `onBackToFirstDegree` | `() => void` | `undefined` | Function called when back to first degree button is pressed |
| `onClearAll` | `() => void` | `undefined` | Function called when clear all button is pressed |
| `showClearButton` | `boolean` | `true` | Whether to show the clear all button |
| `showBackToFirstDegree` | `boolean` | `false` | Whether to show the back to first degree button |
| `disabled` | `boolean` | `false` | Whether all controls are disabled |
| `className` | `string` | `undefined` | Additional CSS classes |

## User Interactions

### **Dragging**
- **Touch**: Drag the handle bar to move controls around the screen
- **Mouse**: Click and drag the handle bar (for testing on desktop)
- **Constraints**: Controls automatically stay within screen bounds

### **Collapsing/Expanding**
- **Toggle**: Click the chevron button in the top-right of the handle
- **State**: Controls remember their collapsed state between sessions

### **Position Reset**
- **Double-Tap**: Double-tap the drag handle to reset to default position (top-left)
- **Auto-Reset**: Position automatically resets on screen orientation changes

### **Zoom Controls**
- **Zoom In**: Tap the "+" button to zoom in
- **Zoom Out**: Tap the "-" button to zoom out  
- **Reset Zoom**: Tap the reset button to return to default zoom level

## Technical Details

### **State Management**
- Uses React hooks for state management
- Persists position and collapsed state in localStorage
- Handles screen orientation changes gracefully

### **Event Handling**
- Touch events for mobile devices
- Mouse events for desktop testing
- Prevents text selection during drag operations

### **Performance**
- Debounced position updates during dragging
- Efficient re-renders with React.memo pattern
- Minimal DOM manipulation

### **Accessibility**
- Proper ARIA labels and roles
- Keyboard navigation support
- Screen reader friendly

## Styling

The component uses Tailwind CSS classes and follows the existing design system:
- **Colors**: Consistent with the app's color scheme
- **Typography**: Appropriate text sizes for mobile
- **Spacing**: Mobile-optimized padding and margins
- **Borders**: Consistent border styling with the app theme

## Browser Support

- **Mobile**: iOS Safari, Chrome Mobile, Samsung Internet
- **Desktop**: Chrome, Firefox, Safari, Edge (for testing)
- **Touch Events**: Modern browsers with touch event support
- **localStorage**: Browsers with localStorage support

## Future Enhancements

Potential improvements that could be added:
- **Haptic Feedback**: Vibration feedback on mobile devices
- **Gesture Recognition**: Pinch-to-zoom support
- **Custom Positions**: Predefined position presets
- **Animation**: Smooth transitions between positions
- **Themes**: Light/dark mode support
