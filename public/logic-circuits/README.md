# LogicCircuits

Pulled from https://www.iti.uni-luebeck.de/fileadmin/Lehre/TGI/Tools/LogicCircuits/ and modified to expose the file handler.

## Exposed properties

```ts
// Load a file based on its text contents
window.LogicCircuits.loadFile(text: string)

// Manually call FileHandler.fileToSimulator etc.
window.LogicCircuits.FileHandler

// Needed by FileHandler
window.LogicCircuits.simulatorController
```
