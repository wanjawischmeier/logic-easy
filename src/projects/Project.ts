import { computed, reactive, isReactive, type UnwrapNestedRefs } from "vue";
import type { Component } from "vue";

export type TruthTableCell = 0 | 1 | '-';
export type TruthTableData = TruthTableCell[][];

export interface BaseProjectProps {
    name: string;
    [key: string]: unknown;
}

export interface BaseProjectState {
    dockviewLayout?: unknown;
    panelStates?: Record<string, Record<string, unknown>>;
    [key: string]: unknown;
}

export abstract class Project<
    TProps extends BaseProjectProps = BaseProjectProps,
    TState extends BaseProjectState = BaseProjectState
> {
    static currentProject: Project | null = null;
    props: TProps;
    state?: UnwrapNestedRefs<TState>;

    constructor(props: TProps, state?: TState) {
        this.props = props;
        console.log('[Project.constructor] Creating project instance:', {
            propsName: props.name,
            hasState: !!state,
            stateKeys: state ? Object.keys(state) : [],
            isStateReactive: state ? isReactive(state) : false,
            state: state
        });
        if (state) {
            // Only wrap in reactive if not already reactive
            this.state = isReactive(state) ? state as UnwrapNestedRefs<TState> : reactive(state) as UnwrapNestedRefs<TState>;
            console.log('[Project.constructor] After setting state:', {
                thisStateKeys: this.state ? Object.keys(this.state) : [],
                thisState: this.state
            });
        }
    }

    // Static method to get default props - subclasses can override
    static get defaultProps(): BaseProjectProps {
        return {
            name: '',
        };
    }

    // Static method to get project state - provides reactive access
    static useProjectState<T extends Project>(): T['state'] | undefined {
        if (!Project.currentProject) return undefined;
        return Project.currentProject.state as T['state'];
    }

    // Static method to create a composable for the project state
    // Subclasses should override this to provide convenient computed properties
    static useState<T extends Project>(): { state: any } {
        const state = computed(() => this.useProjectState<T>());
        return { state };
    }

    abstract restoreDefaultPanelLayout(): void;
    abstract createState(): void;
}

// Type for the Project constructor
export interface ProjectConstructor<TProps extends BaseProjectProps = BaseProjectProps> {
    new(props: TProps): Project<TProps>;
    get defaultProps(): TProps;
    readonly prototype: Project<TProps>;
}

export interface ProjectTypeDefinition<TProps extends BaseProjectProps = BaseProjectProps> {
    propsComponent: Component;
    projectClass: ProjectConstructor<TProps>;
}
