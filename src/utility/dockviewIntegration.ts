export type DockviewApiMinimal = {
    addPanel: (opts: {
        id: string;
        component: string;
        title?: string;
        params?: Record<string, unknown>;
        position?: unknown;
    }) => void;
};

export function getDockviewApi(): DockviewApiMinimal | null {
    const api = (window as unknown as { __dockview_api?: DockviewApiMinimal }).__dockview_api;
    return api ?? null;
}

export function getSharedParams(): Record<string, unknown> | undefined {
    const params = (window as unknown as { __dockview_sharedParams?: Record<string, unknown> }).__dockview_sharedParams;
    return params;
}

export function addPanel(panelKey: string, label: string): boolean {
    const api = getDockviewApi();
    if (!api) {
        console.warn('Dockview API not ready yet');
        return false;
    }

    const sharedParams = getSharedParams();
    const id = `panel_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    try {
        api.addPanel({
            id,
            component: panelKey,
            title: label,
            params: sharedParams,
        });
        return true;
    } catch (err) {
        console.error('Failed to add panel', err);
        return false;
    }
}
