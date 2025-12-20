Panels are top-level UI regions mounted into the `dock-view` layout.

# Responsibilities

Compose components into larger application panels.

# Usage

Panels are registered with the dock/router system; keep them focused on wiring components, state, and lifecycle interactions.

Register a component by creating a `DockEntry` in the `dockRegistry` array in `router/dockRegistry.ts`. The `dockRegistry` is responsible for automatically registering all components in that array within the main app component.
