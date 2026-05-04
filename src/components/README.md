Contains reusable Vue components used across the app.

# Responsibilities

Provide presentational and small interactive UI building blocks (headers, renderers, panels, widgets).

# Usage

Import the component in parent views or panels and pass props/events according to the component API.

**Guideline**: keep heavy logic elsewhere, components should focus on rendering and user interactions.

# Key files

- `DockViewHeader.vue`: header for the dock view.
- `HeaderMenuBar.vue`: top header menu bar component.
- `IFramePanel.vue`: lightweight iframe-based panel wrapper.
