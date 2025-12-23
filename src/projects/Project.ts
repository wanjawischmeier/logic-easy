import type { Component } from "vue";

export interface BaseProjectProps {
    name: string;
    [key: string]: unknown;
}

export abstract class Project<TProps extends BaseProjectProps = BaseProjectProps> {
    props: TProps;

    constructor(props: TProps) {
        this.props = props;
    }

    // Static method to get default props - subclasses can override
    static get defaultProps(): BaseProjectProps {
        return {
            name: '',
        };
    }

    abstract restoreDefaultPanelLayout(): void;
    abstract create(): void;
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
