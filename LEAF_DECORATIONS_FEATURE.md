# Leaf Decorations Feature

## Overview
This feature adds natural-looking leaf decorations along the connection lines between nodes in the network visualization. The leaves are evenly spaced, clickable, and provide visual enhancement to the network graph.

## Features

### Visual Design
- **Natural Leaf Shape**: Each leaf uses an SVG path to create a realistic leaf appearance
- **Varied Sizes**: Random sizing between 0.6x and 1.0x scale for natural variety
- **Color Variation**: Multiple shades of green (#4ade80, #22c55e, #16a34a, #15803d)
- **Smooth Animations**: CSS transitions for hover effects and interactions

### Positioning
- **Even Distribution**: 3 leaves per connection, positioned at 25%, 50%, and 75% along the line
- **Natural Variation**: Small random offsets (±5%) to avoid perfect alignment
- **Dynamic Rotation**: Leaves automatically rotate to point along the connection direction
- **Real-time Updates**: Positions update automatically as nodes move during simulation

### Interactivity
- **Clickable**: Each leaf can be clicked for future functionality implementation
- **Tooltips**: Hover shows connection information (source ↔ target)
- **Hover Effects**: Visual feedback with scaling, brightness, and shadow changes
- **Event Handling**: Proper event propagation and click handling

## Implementation Details

### D3.js Integration
- **Link Groups**: Each connection creates a group containing the line and leaf decorations
- **SVG Paths**: Leaves use complex SVG path data for realistic appearance
- **Transform Attributes**: Position and rotation handled via SVG transforms
- **Performance Optimized**: Efficient DOM manipulation and event handling

### CSS Styling
- **Drop Shadows**: Subtle shadows for depth and visual appeal
- **Smooth Transitions**: CSS transitions for all interactive states
- **Responsive Design**: Works across different screen sizes and zoom levels
- **Pointer Events**: Proper event handling for leaves vs. connection lines

### Code Structure
```typescript
// Leaf creation in renderLinks function
const leafGroup = linkGroup
  .append("g")
  .attr("class", "leaf-decoration")
  .attr("data-leaf-index", i)
  .attr("data-offset", randomOffset.toString());

// Position updates in tick function
const adjustedT = Math.max(0.1, Math.min(0.9, t + storedOffset));
const leafX = source.x + dx * adjustedT;
const leafY = source.y + dy * adjustedT;
const angle = Math.atan2(dy, dx) * 180 / Math.PI;
```

## Future Enhancements

### Planned Features
- **Leaf Types**: Different leaf shapes for different connection types
- **Animation**: Leaf growth/fall animations when connections appear/disappear
- **Interactive Menus**: Right-click context menus for leaf actions
- **Customization**: User-configurable leaf appearance and behavior

### Technical Improvements
- **Performance**: Optimize for large networks with many connections
- **Accessibility**: ARIA labels and keyboard navigation support
- **Theming**: Support for different color schemes and visual styles
- **Mobile**: Touch-friendly interactions for mobile devices

## Usage

The leaf decorations are automatically generated for all network connections and require no additional configuration. Users can:

1. **Hover** over leaves to see connection information
2. **Click** on leaves for future interactive features
3. **Observe** natural movement as the network simulation runs
4. **Enjoy** enhanced visual appeal of the network graph

## Browser Support

- **Modern Browsers**: Full support for SVG, CSS transitions, and ES6+
- **Mobile**: Responsive design with touch-friendly interactions
- **Performance**: Optimized for smooth animations and interactions
