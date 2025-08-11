## Expand network implementation plan

- Goal: Clicking “Expand network” on any non–main-artist node should add up to three new collaborators for that node, and those newly added nodes should also be expandable. Fix cases where some nodes cannot expand and where one click triggers multiple expansions.

### A. Enable expand on any non–main-artist node
1) UI gating
- Change `NetworkTooltip` to show the expand action for any node that is not the main artist.
  - In `client/src/components/network-visualizer.tsx`, instead of passing `isFirstDegreeCollaborator` to gate expand, pass a simpler prop like `canExpand={!isMainArtist}`.
  - In `client/src/components/network-tooltip.tsx`, render the expand block when `!isMainArtist` (and optionally hide/disable if already expanded; see section C).

2) Recursive expand
- No extra UI needed: once new nodes render, they’ll also receive `canExpand={!isMainArtist}` and can be expanded in turn.

Acceptance:
- Expand button appears for all non–main-artist nodes, including second-layer and beyond.

### B. Identity normalization (prevent mismatches and duplicate merges)
1) Canonical IDs
- Treat `node.id` as the canonical identifier everywhere.
- In `use-network-data.expandNodeNetwork`, keep using `id` as the primary key. Ensure all link keys are derived from canonical ids.
- Normalize link keys as undirected pairs to avoid duplicates:
  - Use `const key = s < t ? s + '|' + t : t + '|' + s` when building `existingLinkKeys`.

2) Case-insensitive lookups
- Continue using case-insensitive maps internally, but always write back the canonical id from the returned data when merging.

Acceptance:
- No duplicate links after multiple expansions; expansions consistently match the intended node even with case variances.

### C. Track expanded state and disable redundant expansion
1) Expanded state by canonical id
- In `client/src/hooks/use-network-data.ts`, store `expandedNodes` as a set of node ids (not names).
- When an expansion completes, add the node’s canonical id.
- In `NetworkTooltip`, optionally render the expand action as disabled/“Already expanded” when `expandedNodes.has(node.id)`.

Acceptance:
- Attempting to expand an already expanded node does nothing and shows as disabled.

### D. Prevent multi-fire and “expand all” symptoms
1) Concurrency guard per node
- In `use-network-data`, maintain an `expandingNodeIds` set (ref or state).
  - Early-return if expansion for a node id is already in progress.
  - Add before fetch; remove in finally.

2) Single-fire UI handlers
- `NetworkTooltip` handlers already call `preventDefault()` and `stopPropagation()`. Keep that.
- Ensure the keyboard and mouse handlers don’t double-trigger:
  - Keep `onClick` for mouse and `onKeyDown` for Enter/Space but rely on the per-node concurrency guard to avoid duplicate calls landing.
- In `use-node-interactions.handleNodeClick`, guard to left-click only if needed and keep `event.stopPropagation()` (already present).

3) Background click
- Keep SVG background click to only hide tooltip (already checks event target).

Acceptance:
- Clicking a single expand button runs exactly one expansion; no other nodes expand inadvertently.

### E. Expand selection policy and merge accuracy
1) Neighbor selection
- Keep “up to 3 direct neighbors” of the clicked node. Prefer neighbors not already in the graph; then allow existing ones to ensure up to 3 links are visible.
- Only add links that connect the clicked node to the selected neighbors.

2) Preserve rest of graph
- Keep using `fullNetworkData` as the accumulator so subsequent expansions build on prior ones.

Acceptance:
- Each expansion adds at most three collaborators for the clicked node and only the links connecting the clicked node to those new neighbors.

### F. UX niceties
- Visual hint (optional): small “Expanded” badge on nodes present in `expandedNodes`.
- Show a lightweight toast/message if no new neighbors are found.

### G. Tests
- Unit tests for `use-network-data.expandNodeNetwork`:
  - Expanding adds at most three nodes and only links to the clicked node.
  - No duplicate links after repeated expansions.
  - Expanding the same node twice results in no additional changes.
- Interaction tests for `NetworkTooltip`:
  - Expand visible for all non–main-artist nodes; hidden for main.
  - Expand disabled when node is already expanded.
  - One click triggers one expansion despite rapid clicks or key presses.

### H. Observability
- Keep current debug logs but gate behind a verbose flag to avoid console noise in production.


