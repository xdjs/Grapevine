# Network Visualizer Refactoring Plan

## Overview
The `network-visualizer.tsx` file is currently 1467 lines and contains multiple responsibilities. This plan breaks it into smaller, modular components and utilities to improve maintainability, testability, and code reusability.

## Current Issues
- **Massive file size**: 1467 lines with multiple responsibilities
- **Complex D3 logic**: All visualization logic in one useEffect
- **Mixed concerns**: Event handling, state management, UI rendering all intertwined
- **Difficult testing**: Large component with complex dependencies
- **Hard to maintain**: Changes in one area can affect unrelated functionality

## Refactoring Strategy

### Phase 1: Extract Utilities and Hooks

#### Task 1.1: Create D3 Event Handlers Utility
**Description**: Extract all D3 event handling logic into separate utility functions
**Files Affected**: 
- `client/src/utils/d3-event-handlers.ts` (new)
- `client/src/components/network-visualizer.tsx`
**Dependencies**: None
**Side Effects**: None - pure utility functions
**Tests**: Create unit tests using Jest for touch, zoom, drag, and wheel event handlers (follow existing pattern from loading-screen.test.tsx)

#### Task 1.2: Create Network Data Processing Utilities
**Description**: Extract network data processing logic (connected components, filtering, positioning)
**Files Affected**:
- `client/src/utils/network-data-processor.ts` (new)
- `client/src/components/network-visualizer.tsx`
**Dependencies**: `@/types/network`
**Side Effects**: None - pure utility functions
**Tests**: Create unit tests using Jest for component finding, positioning algorithms, and filtering logic

#### Task 1.3: Create Zoom Management Hook
**Description**: Extract zoom-related state and logic into a custom hook
**Files Affected**:
- `client/src/hooks/use-zoom-control.ts` (new)
- `client/src/components/network-visualizer.tsx`
**Dependencies**: D3, react
**Side Effects**: Manages zoom state and SVG transformations
**Tests**: Create tests for zoom in/out/reset functionality and boundary conditions

#### Task 1.4: Create Network State Management Hook
**Description**: Extract network-related state management into a custom hook
**Files Affected**:
- `client/src/hooks/use-network-state.ts` (new)
- `client/src/components/network-visualizer.tsx`
**Dependencies**: react, `@/types/network`
**Side Effects**: Manages artist modals, collaboration popups, profile data
**Tests**: Test state transitions and data flow

### Phase 2: Extract D3 Visualization Components

#### Task 2.1: Create D3 Simulation Manager
**Description**: Extract D3 force simulation setup and management
**Files Affected**:
- `client/src/components/d3/simulation-manager.tsx` (new)
- `client/src/components/network-visualizer.tsx`
**Dependencies**: D3, network data utilities
**Side Effects**: Creates and manages D3 force simulation
**Tests**: Test simulation initialization, force configuration, and cleanup

#### Task 2.2: Create Node Renderer Component
**Description**: Extract node rendering logic (circles, images, multi-role visualization)
**Files Affected**:
- `client/src/components/d3/node-renderer.tsx` (new)
- `client/src/components/network-visualizer.tsx`
**Dependencies**: D3, profile pictures utility
**Side Effects**: Renders SVG nodes with profile images
**Tests**: Test single-role nodes, multi-role nodes, and image loading

#### Task 2.3: Create Link Renderer Component
**Description**: Extract link/edge rendering logic
**Files Affected**:
- `client/src/components/d3/link-renderer.tsx` (new)
- `client/src/components/network-visualizer.tsx`
**Dependencies**: D3
**Side Effects**: Renders SVG links between nodes
**Tests**: Test link creation and positioning

#### Task 2.4: Create Label Renderer Component
**Description**: Extract text label rendering logic
**Files Affected**:
- `client/src/components/d3/label-renderer.tsx` (new)
- `client/src/components/network-visualizer.tsx`
**Dependencies**: D3
**Side Effects**: Renders text labels for nodes
**Tests**: Test label positioning, font sizing, and visibility

### Phase 3: Extract Interaction Components

#### Task 3.1: Create Tooltip Manager Component
**Description**: Extract complex tooltip creation, positioning, and interaction logic
**Files Affected**:
- `client/src/components/tooltip/tooltip-manager.tsx` (new)
- `client/src/components/tooltip/tooltip-content.tsx` (new)
- `client/src/components/network-visualizer.tsx`
**Dependencies**: D3, React Portal, network state hook
**Side Effects**: Creates and manages tooltip DOM elements
**Tests**: Test tooltip positioning, content generation, and click handlers

#### Task 3.2: Create Node Interaction Handler
**Description**: Extract node click, hover, and selection logic
**Files Affected**:
- `client/src/components/interactions/node-interaction-handler.tsx` (new)
- `client/src/components/network-visualizer.tsx`
**Dependencies**: Tooltip manager, network state hook
**Side Effects**: Handles node highlighting and interaction state
**Tests**: Test click handling, highlighting, and state changes

#### Task 3.3: Create Touch and Zoom Handler
**Description**: Extract touch gesture and zoom interaction logic
**Files Affected**:
- `client/src/components/interactions/touch-zoom-handler.tsx` (new)
- `client/src/components/network-visualizer.tsx`
**Dependencies**: Zoom control hook, D3 event handlers
**Side Effects**: Manages touch events and zoom transformations
**Tests**: Test pinch gestures, wheel events, and zoom boundaries

### Phase 4: Create Composite Components

#### Task 4.1: Create D3 Network Canvas Component
**Description**: Combine D3 rendering components into a cohesive canvas component
**Files Affected**:
- `client/src/components/d3/d3-network-canvas.tsx` (new)
- `client/src/components/network-visualizer.tsx`
**Dependencies**: All D3 sub-components, simulation manager
**Side Effects**: Manages SVG element and D3 integration
**Tests**: Integration tests for complete D3 rendering pipeline

#### Task 4.2: Create Network Controls Component
**Description**: Extract zoom controls and network manipulation UI
**Files Affected**:
- `client/src/components/network-controls.tsx` (new)
- `client/src/components/network-visualizer.tsx`
**Dependencies**: Zoom control hook, network state hook
**Side Effects**: Renders control buttons and handles user input
**Tests**: Test control button functionality and state synchronization

#### Task 4.3: Create Filter Integration Component
**Description**: Extract filter state integration and node visibility logic
**Files Affected**:
- `client/src/components/filter-integration.tsx` (new)
- `client/src/components/network-visualizer.tsx`
**Dependencies**: Filter utilities, D3 canvas
**Side Effects**: Updates node visibility based on filter state
**Tests**: Test filter application and node visibility changes

### Phase 5: Finalize Main Component

#### Task 5.1: Refactor Main Network Visualizer Component
**Description**: Simplify main component to orchestrate sub-components
**Files Affected**:
- `client/src/components/network-visualizer.tsx`
**Dependencies**: All new components and hooks
**Side Effects**: Coordinates between sub-components
**Tests**: Integration tests for complete component functionality

#### Task 5.2: Create Integration Tests
**Description**: Create comprehensive tests for the refactored component system
**Files Affected**:
- `client/src/components/__tests__/network-visualizer.integration.test.tsx` (new)
- `client/src/components/__tests__/d3-integration.test.tsx` (new)
**Dependencies**: All components, testing utilities
**Side Effects**: None - test files only
**Tests**: Test complete user workflows and component interactions

## File Structure After Refactoring

```
client/src/
├── components/
│   ├── network-visualizer.tsx (simplified)
│   ├── network-controls.tsx
│   ├── filter-integration.tsx
│   ├── d3/
│   │   ├── d3-network-canvas.tsx
│   │   ├── simulation-manager.tsx
│   │   ├── node-renderer.tsx
│   │   ├── link-renderer.tsx
│   │   └── label-renderer.tsx
│   ├── interactions/
│   │   ├── node-interaction-handler.tsx
│   │   └── touch-zoom-handler.tsx
│   ├── tooltip/
│   │   ├── tooltip-manager.tsx
│   │   └── tooltip-content.tsx
│   └── __tests__/
│       ├── network-visualizer.integration.test.tsx
│       └── d3-integration.test.tsx
├── hooks/
│   ├── use-zoom-control.ts
│   └── use-network-state.ts
├── utils/
│   ├── d3-event-handlers.ts
│   └── network-data-processor.ts
└── types/
    └── network.ts (existing)
```

## Benefits of This Refactoring

1. **Improved Maintainability**: Each component has a single responsibility
2. **Better Testability**: Smaller components are easier to test in isolation
3. **Code Reusability**: Utilities and hooks can be reused across components
4. **Easier Debugging**: Issues can be isolated to specific components
5. **Team Collaboration**: Different team members can work on different components
6. **Performance Optimization**: Components can be optimized or memoized individually

## Risk Mitigation

- **Backward Compatibility**: Maintain the same external API during refactoring
- **Incremental Changes**: Implement changes in phases to minimize risk
- **Comprehensive Testing**: Each phase includes thorough testing requirements
- **Gradual Migration**: Keep original component functional until refactoring is complete

## Estimated Timeline

- **Phase 1**: 2-3 days (utilities and hooks)
- **Phase 2**: 3-4 days (D3 components)
- **Phase 3**: 2-3 days (interaction components)
- **Phase 4**: 2-3 days (composite components)
- **Phase 5**: 1-2 days (finalization and integration tests)

**Total Estimated Time**: 10-15 development days

## Prerequisites

Before starting this refactoring:
1. Ensure comprehensive test coverage of current functionality
2. Document current API and behavior expectations
3. Set up development environment for isolated component testing
4. Create backup branches for rollback if needed

## Testing Infrastructure

The project already uses:
- **Jest** for test runner
- **React Testing Library** for component testing
- Existing test pattern found in `loading-screen.test.tsx`
- All new tests should follow the established patterns and conventions

## Success Criteria

- [ ] All existing functionality preserved
- [ ] Component count reduced from 1 to 10+ focused components
- [ ] Test coverage maintained or improved
- [ ] Performance remains the same or improves
- [ ] Code becomes more maintainable and readable
- [ ] New components can be easily extended or modified 