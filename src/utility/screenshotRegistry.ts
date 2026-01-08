import { type Ref } from 'vue'
import html2canvas from 'html2canvas-pro'
import JSZip from 'jszip'
import { loadingService } from './loadingService'

interface ScreenshotRegistration {
    id: string
    targetRef: Ref<HTMLElement | null>
    filename: string
}

class ScreenshotRegistry {
    private registrations = new Map<string, ScreenshotRegistration>()

    register(id: string, targetRef: Ref<HTMLElement | null>, filename: string) {
        this.registrations.set(id, { id, targetRef, filename })
    }

    unregister(id: string) {
        this.registrations.delete(id)
    }

    async captureScreenshot(
        element: HTMLElement,
        backgroundColor = 'transparent',
        padding = '1rem'
    ): Promise<Blob | null> {
        const computedStyle = window.getComputedStyle(element)

        // Save computed styles safely
        const originalOverflow = computedStyle.overflow
        const originalHeight = computedStyle.height
        const originalPadding = computedStyle.padding

        // Find and hide elements marked to be ignored in screenshots
        const ignoredElements = element.querySelectorAll('[data-screenshot-ignore]')
        const originalDisplayValues = new Map<Element, string>()

        ignoredElements.forEach((el) => {
            const htmlEl = el as HTMLElement
            originalDisplayValues.set(el, htmlEl.style.display)
            htmlEl.style.display = 'none'
        })

        try {
            // Temporarily modify styles
            element.style.overflow = 'visible'
            element.style.height = 'auto'
            element.style.position = 'relative'
            element.style.padding = padding

            const canvas = await html2canvas(element, {
                backgroundColor,
                scale: window.devicePixelRatio || 2,
                useCORS: true,
                allowTaint: true,
                logging: false
            })

            // Return blob instead of downloading
            return new Promise<Blob | null>((resolve) => {
                canvas.toBlob((blob) => {
                    resolve(blob)
                })
            })
        } finally {
            // Restore ignored elements
            ignoredElements.forEach((el) => {
                const htmlEl = el as HTMLElement
                htmlEl.style.display = originalDisplayValues.get(el) || ''
            })

            // Always restore styles
            element.style.overflow = originalOverflow
            element.style.height = originalHeight
            element.style.padding = originalPadding
            element.style.position = ''
        }
    }

    async exportAll(): Promise<void> {
        loadingService.show('Exporting project as screenshots...')
        const registrations = Array.from(this.registrations.values())

        if (registrations.length === 0) {
            console.warn('No screenshots registered')
            return
        }

        console.log(`Exporting ${registrations.length} screenshots...`)

        const zip = new JSZip()
        const timestamp = new Date().toISOString().slice(0, 10)
        let index = 1

        for (const { targetRef, filename } of registrations) {
            if (!targetRef.value) {
                console.warn(`Skipping ${filename}: element not found`)
                continue
            }

            try {
                const blob = await this.captureScreenshot(targetRef.value, filename)
                if (blob) {
                    zip.file(`${filename}-${timestamp}-${index}.png`, blob)
                    index++
                }
                // Small delay between screenshots to avoid overwhelming the browser
                await new Promise(resolve => setTimeout(resolve, 100))
            } catch (error) {
                console.error(`Failed to capture ${filename}:`, error)
            }
        }

        // Generate and download the zip file
        const zipBlob = await zip.generateAsync({ type: 'blob' })
        const url = URL.createObjectURL(zipBlob)
        const link = document.createElement('a')
        link.href = url
        link.download = `screenshots-${timestamp}.zip`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)

        console.log('All screenshots exported to zip')
        loadingService.hide()
    }

    getRegistrationCount(): number {
        return this.registrations.size
    }

    clear(): void {
        this.registrations.clear()
    }
}

// Export singleton instance
export const screenshotRegistry = new ScreenshotRegistry()
