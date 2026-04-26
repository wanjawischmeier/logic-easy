# Central Automaton Modules

The main purpose of the automaton project type is to keep automaton behavior consistent across panels and the external FSM editor. This includes all of the following goals: 
- Provide one shared automaton data model.
- Coordinate sync between app state and FSM iframe.
- Expose derived automaton data for UI modules.
- Prevent sync loops and redundant updates.


## Structure

- `AutomatonProject.ts` -> main domain entry for automaton projects.
  - owns editor/app synchronization behavior.
  - exposes reactive automaton state via `useState()`.
  - handles normalization, listener lifecycle, and project hooks.

- `AutomatonTypes.ts` -> type definitions for automaton data.
  - includes state, transition, binary row, and sync-related shapes.

- `AutomatonPropsComponent.vue` -> Project creation/config UI for automaton-specific properties.


### Possible naming misunderstandings

It is important to notice that the following names are used to label different modules and data structures: 
-  'automaton state' and 'state'
-> The term 'automaton state' as used in the main module refers to the central project state, whereas the term 'state' is also used to label the state nodes of the automaton (e.g. the initial state in which the automaton starts its processses)
- 'automaton type' and '... type'
-> Since we implemented this project mainly in TS, the term 'type' is used to define data models. E.g. the file 'AutomatonTypes.ts' therefore includes all these definitions. In contrast to that, the term 'automaton type' is also used to label the variable which states the type ['mealy' | 'moore'] of one specific automaton.


## Automaton Synchronization

This page describes the automaton data flow between the editor, the table view, the logic circuits iframe, and the central (saved) project state.
The goal is to help contributors understand behavior, avoid sync loops, and reason about side effects.


### Core model

There is one shared automaton model in app state, therefore all relevant automaton data will be saved in it. The main goal is to handle the data flow in this one central unit and not e.g. in the (external) fsm engine. 
Accordingly, all UI parts read from it, and all relevant edits shall write back to it.


#### Data Flow 1: Editor to app

The FSM editor iframe does not reload after each change. Instead, the app sends and receives incremental data messages so that fsm engine and automaton state are synced in case of real changes. 
When a user edits the automaton inside the FSM editor, the editor sends an export message. Then, the app ...
1. verifies the message is trusted and comes from the expected iframe
-> goal: to prevent unintended updates of the state data from other event messages. 
2. parses and normalizes the payload of the event message 
-> goal: to export data structured according to the automaton state model, so that we did not have to change the whole fsm engine data/stores models (throttled and deduplicated sync).
3. compares it with the last imported snapshot 
-> goal: to analyze whether the event message includes new and important changes which must lead to automaton state data updates. 
4. updates shared automaton state only if something really changed
-> goal: to analyze whether data changes occured which must be displayed in >= one of the panels and to not update data with "unknown", "none" or those which can only be edited in other modules. 
This (a bit complx) pipeline avoids unnecessary updates from duplicate exports and interfering with the own data models/stores of the fsm engine. 


#### Data Flow 2: App to editor

When automaton state changes in the app, the editor is updated through a message. The app then:
1. waits briefly (short debounce) to combine rapid edits. 
-> goal: to prevent update times but also to prevent weird-looking / incomplete changes and sync-loops with the central automaton state.
2. normalizes and compares with the last sent snapshot
-> goal: to prevent unnecessary overhead. 
3. sends only real changes to the FSM editor iframe
-> goal: to only update and display these in the editor instead of re-loading everything on every change. 

This shall keep the editor in sync without spamming messages and unwanted changes.


#### Data Flow 3: State table edits

Edits from the state/transition table directly modify the shared automaton model.
Typical actions:
- add/remove states
- rename states
- change initial/final properties
- change input/output bit widths
- edit transition target/output bits
After each table-driven update, the app marks the change source as table-originated, then the app-to-editor flow propagates it to the FSM editor.


#### Flow 4: KV diagram edits (in automaton mode)

In automaton mode, the app maps edits in kv cells back to automaton transitions and updates the shared automaton model (which leads to app-to-editor synchronization as usual).
This write-back only happens when automaton mode and export-back settings are enabled. Otherwise, other project settings shall be applied.


#### Data Flow 5: Automaton to KV projection

KV data is derived from automaton transitions (which include from- and to-'state nodes'). The app computes a truth-table like projection from them and then derives minimization/formula data for the currently displayed output (minimized function and possibly kv diagram). As in the TruthTable modules, the computed minimized function (latex formula) is always shown.
The kv diagram can only be displayed if the user used the right amount of variables. 

To keep highlight colors stable, the app keeps output-specific minimization cache data. This prevents color jumps when switching outputs or when the user changes non-visible output in other modules.


### Loop prevention and stability rules

Currently, all app state changes are saved with a longer debounce to ensure data persistence.
The synchronization layer uses three practical protections:
- source tagging, so editor-originated updates are not immediately echoed back
- snapshot comparison, so identical states are not resent
- debounce windows, so bursts of edits are merged
Together, these rules prevent feedback loops and reduce unnecessary traffic.
Possibly, some debounces and checks should be reduced or removed in the future (while ensuring the functionality by using different strategies) to reduce unnecessary sync latency, redundant flags and message traffic.


## Usage

Treat this folder as the single automaton domain layer.
Panels and components should consume it, not re-implement sync or normalization logic.