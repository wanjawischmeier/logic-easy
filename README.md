# LogicEasy

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
