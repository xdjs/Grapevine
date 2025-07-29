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

**Tests**:
- Create `use-config.test.ts`
- Test config fetching on mount
- Test error handling for config API failures
- Mock `/api/config` endpoint

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

**Tests**:
- Create `use-zoom.test.ts`
- Test zoom in/out functionality
- Test zoom reset
- Test zoom bounds (min/max limits)
- Test custom zoom events

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

**Tests**:
- Create `use-touch-gestures.test.ts`
- Test pinch gesture detection
- Test wheel zoom handling
- Test touch event cleanup
- Mock touch events for testing

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

**Tests**:
- Create `network-tooltip.test.tsx`
- Create `use-tooltip.test.ts`
- Test tooltip positioning logic
- Test action handler functionality
- Test mobile vs desktop tooltip behavior
- Mock external navigation actions

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

**Tests**:
- Create `use-node-interactions.test.ts`
- Test node click handling
- Test node highlighting/reset
- Test drag behavior
- Test collaboration data setting
- Mock D3 event objects

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

**Tests**:
- Create `d3-network-renderer.test.tsx`
- Test D3 simulation initialization
- Test node/link rendering
- Test boundary force application
- Test responsive behavior
- Mock D3 selection and simulation APIs

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

**Tests**:
- Create `use-filter-visibility.test.ts`
- Test node visibility calculation
- Test multi-role node filtering
- Test link visibility based on connected nodes
- Mock D3 selections for visibility testing

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

**Tests**:
- Create `use-modals.test.ts`
- Test modal state management
- Test artist selection handling
- Test collaboration popup logic
- Mock external link creation

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

**Tests**:
- Update existing `network-visualizer.test.tsx` if it exists
- Create integration tests for component coordination
- Test props interface compatibility
- Test error handling and edge cases

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

**Tests**:
- Create `zoom-controls-enhanced.test.tsx`
- Test zoom button interactions
- Test accessibility features
- Test custom event dispatching

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

**Tests**:
- Create `network-reset-button.test.tsx`
- Test button visibility conditions
- Test reset functionality
- Test accessibility features

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

## Testing Strategy

### Unit Tests
- Each hook should have comprehensive unit tests
- Mock external dependencies (APIs, D3, DOM events)
- Test edge cases and error conditions
- Aim for >90% code coverage on new hooks

### Integration Tests
- Test hook interactions and data flow
- Test component rendering with various prop combinations
- Test responsive behavior and mobile interactions

### Visual Regression Tests
- Ensure D3 visualization renders correctly after refactoring
- Test zoom and pan functionality
- Test tooltip positioning and appearance

### Performance Tests
- Ensure no performance regression in D3 rendering
- Test with large network datasets
- Monitor memory usage with frequent interactions

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

## Success Criteria

### Code Quality
- Each file < 200 lines
- Clear single responsibility for each hook/component
- Comprehensive test coverage (>85%)
- No ESLint warnings or TypeScript errors

### Functionality
- All existing features work identically
- No performance regression
- Improved error handling and edge case coverage

### Maintainability
- New features can be added to individual hooks
- Bug fixes can be isolated to specific areas
- Code is self-documenting with clear interfaces

### Developer Experience
- Easier to understand individual pieces
- Faster to locate and fix issues
- Better debugging with isolated concerns 