Application state management for domain objects.

# Responsibilities

Define and manipulate the state for the currently loaded project.

# Usage

Import state helpers into panels/components; avoid duplicating state logic in UI components.

**For example**: `useTruthTableState` can be used in all components to reactively get the truth table state (without the need for duplicate logic).

# Key files

- `stateManager.ts`: high-level state orchestration.
- `truthTableState.ts`: truth table specific state model and helpers.
