# LogicEasy

Documentation is available at https://wanjawischmeier.github.io/logic-easy/docs/

## Serving

### Development

```bash
# Running the main application
npm run dev

# Running the fsm module on its own
npm run fsm:dev

# Running the docs module on its own
npm run docs:dev
```

> [!NOTE]  
> Running the main application in development mode uses the most recent build of the submodules. So if you made a change to a submodule, build it again to see the changes in the main app. `npm run build` automatically builds the submodules.

### Production

```bash
# Build main application
npm run build

# Build fsm module
npm run fsm:build

# Build docs module
npm run docs:build

# Serve main application
serve -s dist
```

> [!NOTE]  
> Building the main application automatically creates updated builds of the submodules.

> [!NOTE]  
> The `docs` module requires its builds to be copied from the public folder to the dist folder. Running `npm run build` automatically does this by executing `scripts/copy-docs.js` after the build.

### Testing

```bash
# Run all unit tests
npm run test:unit
```

### Maintaining

```bash
# Update submodules
git submodule update --remote --merge
```

## License

LogicEasy is licensed under the **GNU General Public License v3.0 or later** (`GPL-3.0-or-later`). The full license can be found in [`LICENSE`](LICENSE).

Copyright (C) 2026 Julian Gransee, Aylin Kutluk, Wanja Wischmeier

This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but **without any warranty**; without even the implied warranty of **merchantability** or **fitness for a particular purpose**. See the GNU General Public License for more details.

### Third-party components

The FSM editor in [`public/fsm-engine/`](public/fsm-engine) is a modified fork of [fsm-engine](https://github.com/karthik-saiharsh/fsm-engine) by Karthik Saiharsh. It remains under the GNU General Public License v3.0 or later; the license is kept in [`public/fsm-engine/LICENSE`](public/fsm-engine/LICENSE) and is shipped with every build of the editor (`public/fsm-engine/dist/LICENSE`).
