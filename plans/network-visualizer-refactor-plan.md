# Network Visualizer Refactoring Plan

## Overview
The current `network-visualizer.tsx` file is 1,499 lines long and handles multiple responsibilities. This plan breaks it down into smaller, focused, and testable components following single responsibility principle.

## Current Issues
- **Massive file size** (1,499 lines) making it hard to maintain
- **Multiple responsibilities** in a single component
- **Complex state management** with many useState hooks
- **Mixed concerns** (D3 logic, event handling, UI rendering, data fetching)
- **Difficult to test** individual functionalities
- **Poor reusability** of individual features

## Refactoring Goals
- Break into smaller, focused components (< 200 lines each)
- Separate concerns using custom hooks
- Improve testability with isolated functions
- Maintain existing functionality
- Improve code readability and maintainability
- **Mandatory comprehensive testing** for all code changes

## 🧪 Testing Policy
**CRITICAL REQUIREMENT**: Every code modification and new code MUST include comprehensive tests before implementation. This is non-negotiable for all tasks.

### Testing Requirements
- **Unit Tests**: Test individual functions, hooks, and components in isolation
- **Integration Tests**: Test component interactions and data flow between systems
- **Runnable Tests**: All tests must be executable via standard test runners (Jest/Vitest)
- **Coverage Goals**: Aim for >90% code coverage on all new/modified code
- **Test-First Approach**: Write tests before or during implementation, not after
- **Mock External Dependencies**: Properly mock APIs, D3, DOM events, and external libraries

---

## Tasks

### Task 1: Extract Network Data Management Hook ✅ **COMPLETED**
**Description**: Create a custom hook to manage network expansion, filtering, and data transformations.

**Files Affected**:
- `client/src/hooks/use-network-data.ts` (new) ✅
- `client/src/components/network-visualizer.tsx` (modified) ✅

**Changes**:
- Extract `expandedNodes`, `fullNetworkData`, `isExpandedMode` state ✅
- Move `getFirstDegreeCollaborators`, `getVisibleNodes`, `getVisibleLinks` functions ✅
- Move `expandNodeNetwork`, `collapseNodeNetwork`, `resetToFirstDegree` functions ✅
- Return clean interface for network data management ✅

**Dependencies**: 
- Requires network types from `@/types/network` ✅
- May need to coordinate with tooltip/node interaction logic ✅

**Tests**:
- Create `use-network-data.test.ts` ✅ (comprehensive tests created)
- Test network expansion/collapse functionality ✅
- Test visible nodes filtering ✅
- Test first-degree collaborator detection ✅
- Mock API calls for network expansion ✅

**Results**:
- **Component size reduced**: 1,499 → 1,355 lines (~144 lines extracted)
- **TypeScript compilation**: ✅ Passes without errors
- **Runtime verification**: ✅ Dev server starts successfully
- **Functionality preserved**: ✅ All existing behavior maintained
- **Hook interface**: Clean, well-typed API with proper memoization

---

### Task 2: Extract Configuration Management Hook
**Description**: Create a custom hook to handle configuration fetching and management.

**Files Affected**:
- `client/src/hooks/use-config.ts` (new)
- `client/src/components/network-visualizer.tsx` (modified)

**Changes**:
- Extract `musicNerdBaseUrl` state and config fetching logic
- Move config fetching useEffect
- Provide clean interface for configuration access

**Dependencies**: 
- None

**Tests** (MANDATORY):
- Create `use-config.test.ts` with comprehensive coverage
- Test config fetching on mount and loading states
- Test error handling for config API failures and network issues
- Test retry logic and fallback behavior
- Mock `/api/config` endpoint with various response scenarios
- Test TypeScript interfaces and return types
- Test cleanup and unmounting behavior

---

### Task 3: Extract Zoom Management Hook
**Description**: Create a custom hook to handle all zoom-related functionality.

**Files Affected**:
- `client/src/hooks/use-zoom.ts` (new)
- `client/src/components/network-visualizer.tsx` (modified)

**Changes**:
- Extract `currentZoom` state
- Move `applyZoom`, `applyPinchZoom` functions
- Move zoom button handlers (`handleZoomIn`, `handleZoomOut`, `handleZoomReset`)
- Move zoom event listener logic
- Return zoom controls interface

**Dependencies**: 
- Needs to coordinate with D3 visualization
- May need SVG ref from parent

**Tests** (MANDATORY):
- Create `use-zoom.test.ts` with comprehensive coverage
- Test zoom in/out functionality with various zoom levels
- Test zoom reset to default state
- Test zoom bounds enforcement (min/max limits)
- Test custom zoom events and event handlers
- Test zoom state persistence and updates
- Test pinch zoom integration and touch events
- Mock SVG refs and D3 zoom behavior
- Test edge cases and error conditions

---

### Task 4: Extract Touch/Gesture Handler
**Description**: Create a dedicated component or hook for touch and gesture handling.

**Files Affected**:
- `client/src/hooks/use-touch-gestures.ts` (new)
- `client/src/components/network-visualizer.tsx` (modified)

**Changes**:
- Extract pinch zoom variables and handlers
- Move `handleTouchStart`, `handleTouchMove`, `handleTouchEnd` functions
- Move `handleWheelZoom` function
- Move touch event listener setup/cleanup
- Provide clean interface for gesture events

**Dependencies**: 
- Needs access to zoom functions from Task 3
- Requires SVG element reference

**Tests** (MANDATORY):
- Create `use-touch-gestures.test.ts` with comprehensive coverage
- Test pinch gesture detection and multi-touch handling
- Test wheel zoom handling with various devices
- Test touch event lifecycle (start, move, end)
- Test gesture state management and cleanup
- Test touch event cleanup and memory leaks prevention
- Mock touch events, wheel events, and pointer events
- Test mobile vs desktop behavior differences
- Test edge cases (rapid gestures, interrupted touches)
- Test accessibility and keyboard navigation

---

### Task 5: Extract Tooltip Management System
**Description**: Create a dedicated tooltip component and management hook.

**Files Affected**:
- `client/src/components/network-tooltip.tsx` (new)
- `client/src/hooks/use-tooltip.ts` (new)
- `client/src/components/network-visualizer.tsx` (modified)

**Changes**:
- Extract tooltip state and logic
- Move `showTooltip`, `hideTooltip`, `moveTooltip` functions
- Move `openMusicNerdProfile` function
- Create reusable tooltip component with action handlers
- Move tooltip event handlers (network, expand, collaboration, profile)

**Dependencies**: 
- Needs artist selection modal logic
- Needs collaboration popup logic
- Requires configuration hook from Task 2

**Tests** (MANDATORY):
- Create `network-tooltip.test.tsx` with comprehensive component testing
- Create `use-tooltip.test.ts` with hook behavior testing
- Test tooltip positioning logic and boundary detection
- Test action handler functionality (expand, profile, collaboration)
- Test tooltip show/hide/move state management
- Test mobile vs desktop tooltip behavior differences
- Test tooltip accessibility (ARIA labels, keyboard navigation)
- Mock external navigation actions and API calls
- Test tooltip content rendering with various data types
- Test performance with rapid tooltip updates
- Test tooltip cleanup and memory management

---

### Task 6: Extract Node Interaction Logic
**Description**: Create a hook to handle node clicking, highlighting, and drag behavior.

**Files Affected**:
- `client/src/hooks/use-node-interactions.ts` (new)
- `client/src/components/network-visualizer.tsx` (modified)

**Changes**:
- Extract node highlighting state and logic
- Move `resetNodeHighlight` function
- Move drag functions (`dragstarted`, `dragged`, `dragended`)
- Move node click event handling logic
- Provide clean interface for node interactions

**Dependencies**: 
- Needs tooltip system from Task 5
- Needs network data from Task 1
- Requires D3 node references

**Tests** (MANDATORY):
- Create `use-node-interactions.test.ts` with comprehensive coverage
- Test node click handling and event propagation
- Test node highlighting/reset functionality
- Test drag behavior (start, during, end states)
- Test collaboration data setting and state updates
- Test node selection and multi-node interactions
- Mock D3 event objects and simulation references
- Test mobile vs desktop interaction patterns
- Test accessibility features (keyboard navigation, screen readers)
- Test performance with large node datasets
- Test error handling for invalid node data

---

### Task 7: Extract D3 Visualization Core
**Description**: Create a dedicated component for D3 SVG rendering and simulation.

**Files Affected**:
- `client/src/components/d3-network-renderer.tsx` (new)
- `client/src/components/network-visualizer.tsx` (modified)

**Changes**:
- Extract main D3 useEffect (lines 238-1272)
- Move simulation setup and management
- Move node/link rendering logic
- Move connected components calculation
- Move boundary force and positioning logic
- Create clean props interface for D3 renderer

**Dependencies**: 
- Needs all hooks from previous tasks
- Complex coordination with parent component

**Tests** (MANDATORY):
- Create `d3-network-renderer.test.tsx` with comprehensive component testing
- Test D3 simulation initialization and configuration
- Test node/link rendering with various data sets
- Test boundary force application and positioning constraints
- Test responsive behavior across screen sizes
- Test simulation lifecycle (start, tick, end)
- Mock D3 selection and simulation APIs completely
- Test performance with large networks (1000+ nodes)
- Test memory management and cleanup
- Test error handling for malformed network data
- Test real-time updates and data synchronization
- Test accessibility features in SVG rendering

---

### Task 8: Extract Filter Visibility Management
**Description**: Create a hook to handle node/link visibility based on filter state.

**Files Affected**:
- `client/src/hooks/use-filter-visibility.ts` (new)
- `client/src/components/network-visualizer.tsx` (modified)

**Changes**:
- Extract filter visibility useEffect (lines 1296-1344)
- Move `isNodeVisible` function
- Move filter-based visibility logic for nodes, labels, and links
- Provide clean interface for filter management

**Dependencies**: 
- Needs to coordinate with D3 renderer
- Requires filter state from parent

**Tests** (MANDATORY):
- Create `use-filter-visibility.test.ts` with comprehensive coverage
- Test node visibility calculation with various filter combinations
- Test multi-role node filtering logic and edge cases
- Test link visibility based on connected nodes states
- Test filter state changes and real-time updates
- Test performance with complex filter criteria
- Mock D3 selections for visibility testing
- Test accessibility compliance (screen reader support)
- Test filter persistence and state management
- Test error handling for invalid filter data
- Test integration with network expansion features

---

### Task 9: Extract Modal Management
**Description**: Create a hook to manage modal states and interactions.

**Files Affected**:
- `client/src/hooks/use-modals.ts` (new)
- `client/src/components/network-visualizer.tsx` (modified)

**Changes**:
- Extract modal-related state (`showArtistModal`, `showCollaborationPopup`, etc.)
- Move `handleArtistSelection` function
- Move collaboration popup state management
- Provide clean interface for modal operations

**Dependencies**: 
- Needs configuration from Task 2
- Coordinates with tooltip actions

**Tests** (MANDATORY):
- Create `use-modals.test.ts` with comprehensive coverage
- Test modal state management (open, close, toggle)
- Test artist selection handling and validation
- Test collaboration popup logic and data flow
- Test modal stacking and z-index management
- Test keyboard navigation and ESC key handling
- Test accessibility compliance (focus management, ARIA)
- Mock external link creation and navigation
- Test modal cleanup and memory management
- Test mobile-specific modal behavior
- Test error handling for modal data loading

---

### Task 10: Create Main Network Visualizer Controller
**Description**: Refactor the main component to orchestrate all the extracted hooks and components.

**Files Affected**:
- `client/src/components/network-visualizer.tsx` (major refactor)

**Changes**:
- Import and use all custom hooks from previous tasks
- Simplify main component to coordinate between hooks
- Maintain existing props interface
- Ensure all functionality is preserved
- Add better error boundaries and loading states

**Dependencies**: 
- Uses all hooks and components from Tasks 1-9

**Tests** (MANDATORY):
- Update/create `network-visualizer.test.tsx` with comprehensive integration testing
- Create integration tests for component coordination between all hooks
- Test props interface compatibility and TypeScript validation
- Test error handling and edge cases across all integrated systems
- Test complete user workflows (search → visualize → interact → expand)
- Test performance with real-world data scenarios
- Test accessibility compliance for the entire component
- Test responsive behavior across device types
- Test memory management and cleanup of all sub-systems
- Test error boundaries and graceful degradation
- Test data loading states and error recovery

---

### Task 11: Extract Zoom Controls Component
**Description**: Create a reusable zoom controls component.

**Files Affected**:
- `client/src/components/zoom-controls-enhanced.tsx` (new)
- `client/src/components/network-visualizer.tsx` (modified)

**Changes**:
- Extract zoom controls UI and event handling
- Make zoom controls reusable with prop-based configuration
- Add accessibility features (keyboard navigation, ARIA labels)
- Support custom styling and positioning

**Dependencies**: 
- Uses zoom hook from Task 3

**Tests** (MANDATORY):
- Create `zoom-controls-enhanced.test.tsx` with comprehensive component testing
- Test zoom button interactions (click, keyboard, touch)
- Test accessibility features (ARIA labels, focus management, screen readers)
- Test custom event dispatching and parent communication
- Test disabled states and visual feedback
- Test responsive behavior and mobile optimization
- Test keyboard shortcuts and hotkeys
- Test component styling and theming
- Test prop validation and TypeScript interfaces
- Test performance with rapid button interactions
- Test error handling for invalid zoom values

---

### Task 12: Create Network Reset Button Component
**Description**: Extract the reset button into a reusable component.

**Files Affected**:
- `client/src/components/network-reset-button.tsx` (new)
- `client/src/components/network-visualizer.tsx` (modified)

**Changes**:
- Extract reset button logic and styling
- Make component configurable with props
- Add proper accessibility attributes
- Support different button styles/sizes

**Dependencies**: 
- Uses network data hook from Task 1

**Tests** (MANDATORY):
- Create `network-reset-button.test.tsx` with comprehensive component testing
- Test button visibility conditions and state management
- Test reset functionality and network state clearing
- Test accessibility features (ARIA labels, keyboard navigation)
- Test button styling and responsive behavior
- Test disabled states and loading indicators
- Test error handling for reset failures
- Test integration with network data hook
- Test confirmation dialogs and user feedback
- Test performance and cleanup after reset
- Test TypeScript interfaces and prop validation

---

## Implementation Strategy

### Phase 1 (Tasks 1-3): Foundation Hooks
- Start with data management, configuration, and zoom hooks
- These have minimal dependencies and can be developed in parallel
- Focus on clean interfaces and comprehensive testing

### Phase 2 (Tasks 4-6): Interaction Systems  
- Build touch gestures, tooltip, and node interaction systems
- These depend on Phase 1 hooks but can be developed in parallel
- Requires careful coordinate between systems

### Phase 3 (Tasks 7-8): Core Rendering
- Extract D3 visualization and filter management
- Complex but well-isolated from other systems
- Requires integration with all Phase 1-2 hooks

### Phase 4 (Tasks 9-12): UI Components & Integration
- Extract modals and UI components
- Refactor main component to use all hooks
- Comprehensive integration testing

## 🧪 Comprehensive Testing Strategy

**MANDATORY POLICY**: No code is merged without corresponding tests. Tests must be written before or during implementation.

### Unit Tests (REQUIRED FOR ALL TASKS)
- **Each hook/component** must have comprehensive unit tests
- **Mock external dependencies** (APIs, D3, DOM events, external libraries)
- **Test edge cases** and error conditions thoroughly
- **Code coverage target**: >90% for all new/modified code
- **TypeScript testing**: Validate interfaces, types, and return values
- **Accessibility testing**: ARIA labels, keyboard navigation, screen readers

### Integration Tests (REQUIRED FOR COMPLEX TASKS)
- **Hook interactions**: Test data flow between multiple hooks
- **Component coordination**: Test how components work together
- **Props interface testing**: Validate component APIs and TypeScript contracts
- **Responsive behavior**: Test mobile vs desktop interactions
- **User workflow testing**: Complete user journeys (search → visualize → interact)

### Visual Regression Tests (REQUIRED FOR UI COMPONENTS)
- **D3 visualization rendering**: Ensure correct visual output after refactoring
- **Zoom and pan functionality**: Test interactive controls
- **Tooltip positioning**: Test responsive tooltip behavior
- **Mobile interface**: Test touch interactions and responsive layouts
- **Accessibility compliance**: Test with screen readers and keyboard navigation

### Performance Tests (REQUIRED FOR CRITICAL PATHS)
- **No performance regression**: Benchmark before/after refactoring
- **Large dataset testing**: Test with 1000+ nodes networks
- **Memory management**: Monitor for leaks with frequent interactions
- **React DevTools**: Profile component re-renders and state updates
- **Bundle size impact**: Ensure refactoring doesn't bloat the build

### Test Infrastructure Requirements
- **Test runner**: Jest/Vitest for unit tests
- **React testing**: React Testing Library for component tests
- **Mock frameworks**: MSW for API mocking, jest.mock for modules
- **Coverage reporting**: Istanbul/c8 for coverage metrics
- **Accessibility testing**: @testing-library/jest-dom, axe-core
- **Performance testing**: React profiler, performance.now() benchmarks

## Risk Mitigation

### Backward Compatibility
- Maintain exact same props interface for main component
- Preserve all existing functionality
- Test with existing parent components

### D3 Integration Complexity
- D3 refs and selections are complex to extract
- Plan careful interface between hooks and D3 renderer
- Consider gradual migration approach

### State Coordination
- Multiple hooks sharing state requires careful design
- Use proper dependency management between hooks
- Consider React Context for shared state if needed

### Mobile/Touch Interactions
- Touch gesture extraction is complex
- Test thoroughly on mobile devices
- Maintain gesture responsiveness and accuracy

## ✅ Success Criteria

### Code Quality (MANDATORY)
- **File size**: Each file < 200 lines
- **Single responsibility**: Clear purpose for each hook/component
- **Test coverage**: >90% for all new/modified code (MANDATORY)
- **Zero warnings**: No ESLint warnings or TypeScript errors
- **Documentation**: Comprehensive JSDoc comments for all public APIs

### Testing Quality (MANDATORY)
- **Runnable tests**: All tests pass in CI/CD pipeline
- **Comprehensive coverage**: Unit, integration, and performance tests
- **Mock quality**: Proper mocking of external dependencies
- **Accessibility testing**: Full compliance with WCAG guidelines
- **Error scenarios**: All edge cases and error conditions tested

### Functionality (MANDATORY)
- **Feature parity**: All existing features work identically
- **Performance**: No regression in render times or memory usage
- **Error handling**: Improved error handling and edge case coverage
- **Browser compatibility**: Works across all supported browsers
- **Mobile optimization**: Touch interactions work flawlessly

### Maintainability (MANDATORY)
- **Modularity**: New features can be added to individual hooks
- **Isolation**: Bug fixes can be isolated to specific areas
- **Self-documenting**: Code is clear with well-defined interfaces
- **Type safety**: Complete TypeScript coverage with strict mode
- **Testability**: Easy to write tests for new features

### Developer Experience (MANDATORY)
- **Clarity**: Easier to understand individual pieces
- **Debugging**: Faster to locate and fix issues with isolated concerns
- **Documentation**: Clear README and inline documentation
- **IDE support**: Full IntelliSense and auto-completion
- **Test feedback**: Fast test execution with clear failure messages 