# Leaf Decorations Feature

## Overview
This feature adds natural-looking leaf decorations to the connection lines between nodes in the network visualization. The leaves are designed to look nature-inspired and are evenly spaced along the connection lines.

## Features

### Visual Design
- **Natural Leaf Shapes**: Each leaf is created using SVG paths that mimic realistic leaf forms with natural curves and pointed tips
- **Color Variations**: Leaves have slight variations in green colors to create a more organic, natural appearance
- **Size Variations**: Each leaf has a random scale variation (0.85x to 1.15x) for visual diversity
- **Random Rotation**: Initial random rotation adds to the natural, organic feel
- **Shadow Effects**: Subtle drop shadows provide depth and visual separation from the connection lines

### Positioning
- **Even Distribution**: 3 leaves are placed along each connection line at natural intervals
- **Perpendicular Offset**: Leaves are positioned perpendicular to the connection line for optimal visibility
- **Random Positioning**: Small random variations in position and angle make the layout look more natural
- **Side Variation**: Leaves randomly appear on either side of the connection line

### Interactivity
- **Clickable**: Each leaf is clickable and logs information about the connection it represents
- **Hover Effects**: CSS hover animations include scaling, color changes, and shadow enhancements
- **Event Handling**: Click events are properly isolated to prevent interference with other interactions

### Animation
- **Floating Animation**: Subtle floating animation with staggered timing for each leaf
- **Hover Pause**: Animation pauses on hover for better user interaction
- **Smooth Transitions**: CSS transitions provide smooth hover effects

## Implementation Details

### File Changes
- **`d3-network-renderer.tsx`**: Modified `renderLinks` function to create leaf decorations
- **`index.css`**: Added CSS styles for leaf appearance, animations, and hover effects
- **`use-filter-visibility.ts`**: Updated to handle the new link structure

### Key Functions
- **`renderLinks()`**: Creates link groups with embedded leaf decorations
- **`createLeafPath()`**: Generates SVG path data for natural leaf shapes
- **`getLeafPositions()`**: Calculates optimal positioning for leaves along connection lines

### CSS Classes
- **`.leaf-decoration`**: Container for each leaf with animations and hover effects
- **`.leaf-shape`**: The actual leaf SVG path with styling and transitions

## Future Enhancements
- **Click Functionality**: Implement specific actions when leaves are clicked
- **Leaf Types**: Add different leaf varieties based on connection types or node relationships
- **Seasonal Changes**: Dynamic leaf colors based on time of year or user preferences
- **Performance Optimization**: Lazy loading of leaf decorations for very large networks

## Technical Notes
- Leaves are rendered as SVG groups within link groups for proper organization
- Each leaf gets a unique shadow filter ID to prevent conflicts
- The implementation maintains compatibility with existing filtering and visibility systems
- Leaf decorations automatically update their positions when the network simulation runs

## Usage
The leaf decorations are automatically applied to all connection lines in the network visualization. No additional configuration is required - they will appear whenever the network is rendered with the updated code.
