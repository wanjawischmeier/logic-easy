Project-related logic and utilities.

# Responsibilities

Manage project lifecycle, storage, import/export, metadata, and file operations.

# Usage

Call into these modules from UI flows (popups, menus) or background tasks; prefer public functions exported from `projectManager`.

# Key files

- `projectManager.ts`: orchestrates project lifecycle and selection.
- `projectStorage.ts`: persistence (localStorage / file API) abstractions.
- `projectFileOperations.ts`: reading/writing project files.
- `projectImportExport.ts`: import/export helpers and format converters.
