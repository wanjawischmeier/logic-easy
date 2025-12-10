Utility modules and low-level helpers used across the codebase.

# Responsibilities

All scripts that outsource logic for components/panels and can't be categorized into another folder should live here.

# Key files

- `truthTableInterpreter.ts`: evaluates truth-table logic.
- `logicCircuitsWrapper.ts`: adapter/wrapper for logic-circuits features.
- `espresso.ts`: espresso algorithm helpers.
- `iframeManager.ts`, `dockviewIntegration.ts`: integration helpers for embedding/communicating with iframes or the dock view.
- `popupService.ts`: centralized popup API.
- `types.ts`: shared TypeScript types used across modules.
