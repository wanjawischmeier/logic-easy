import { reactive } from 'vue'

interface LoadingState {
    isLoading: boolean
    message: string
}

/**
 * Global loading state service
 * Use this to show/hide the loading screen from anywhere in the app
 */
class LoadingService {
    private state: LoadingState = reactive({
        isLoading: false,
        message: ''
    })

    /**
     * Show the loading screen with a message
     */
    show(message: string): void {
        this.state.isLoading = true
        this.state.message = message
    }

    /**
     * Hide the loading screen
     */
    hide(): void {
        this.state.isLoading = false
        this.state.message = ''
    }

    /**
     * Get the current loading state (reactive)
     */
    get loading(): LoadingState {
        return this.state
    }
}

export const loadingService = new LoadingService()
