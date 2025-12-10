Popup components used across the application.

# Responsibilities

Modal and popup UIs for user flows (credits, manual, project creation, property editing).

# Usage
Use `PopupBase.vue` for consistent styling and accessibility. For project creation popups, add a props file (like `TruthTableProjectProps.vue`) for each popup type that defines its props and their layout. Those will then be embedded into the content area of `ProjectCreationPopup.vue`. Open/close a popup via `popupService` or parent state.

# Key files

- `PopupBase.vue`: base modal wrapper — use to create consistent general popups.
- `ProjectCreationPopup.vue`: More specialized, use to create project creation popups specifically.