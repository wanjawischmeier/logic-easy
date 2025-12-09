/* Hier habe ich testweise versucht, nicht über die Main zu gehen und dafür ein
anderes file erstellt, um trotzdem theoretisch über die (alte) index.html (nun index-standalone.html)
das submodule selbstständig zu erhalten. die datei hier wird nun statt der main.jsx
im fsmwrapper im hauptprojekt geladen */
import { StrictMode } from "react";
import { Provider } from "jotai";
import { App } from "./app.jsx";
import { createStore } from "jotai";
import { stage_ref, editor_state, layer_ref } from "./lib/stores.js";

// fresh store per mount
export function AppRoot() {
  const freshStore = createStore();

  return (
    <StrictMode>
      <Provider store={freshStore}>
        <App />
      </Provider>
    </StrictMode>
  );
}
