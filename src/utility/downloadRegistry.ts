import { type Ref } from 'vue'
import html2canvas from 'html2canvas-pro'
import JSZip from 'jszip'
import { loadingService } from './loadingService'
import { projectManager } from '@/projects/projectManager'
import { Toast } from './toastService'

type LatexContentResolver = () => string | undefined | Promise<string | undefined>

interface LatexRegistration {
  filename: string
  resolve: LatexContentResolver
}

interface ScreenshotRegistration {
  enabled: boolean
  filename: string
}

interface DownloadRegistration {
  id: string
  targetRef?: Ref<HTMLElement | null>
  screenshot: ScreenshotRegistration
  latexFiles: LatexRegistration[]
}

interface RegisterOptions {
  targetRef?: Ref<HTMLElement | null>
  screenshot?: Partial<ScreenshotRegistration>
  latex?: LatexRegistration | LatexRegistration[]
}

class DownloadRegistry {
  private registrations = new Map<string, DownloadRegistration>()

  register(id: string, options: RegisterOptions) {
    const latexEntries = options.latex
      ? Array.isArray(options.latex)
        ? options.latex
        : [options.latex]
      : []

    const screenshot: ScreenshotRegistration = {
      enabled: options.screenshot?.enabled ?? false,
      filename: options.screenshot?.filename ?? 'screenshot',
    }

    this.registrations.set(id, {
      id,
      targetRef: options.targetRef,
      screenshot,
      latexFiles: latexEntries,
    })
  }

  unregister(id: string) {
    this.registrations.delete(id)
  }

  async captureScreenshot(
    element: HTMLElement,
    backgroundColor = 'transparent',
    padding = '1rem',
  ): Promise<Blob | null> {
    const computedStyle = window.getComputedStyle(element)

    // Save computed styles safely
    const originalOverflow = computedStyle.overflow
    const originalHeight = computedStyle.height
    const originalWidth = computedStyle.width
    const originalPadding = computedStyle.padding

    // Find and hide elements marked to be ignored in screenshots
    const ignoredElements = element.querySelectorAll('[data-screenshot-ignore]')
    const originalDisplayValues = new Map<Element, string>()

    ignoredElements.forEach((el) => {
      const htmlEl = el as HTMLElement
      originalDisplayValues.set(el, htmlEl.style.display)
      htmlEl.style.display = 'none'
    })

    // Find and show elements marked to be shown only in screenshots
    const screenshotOnlyFlexElements = element.querySelectorAll('[data-screenshot-only-flex]')
    const originalScreenshotOnlyDisplayValues = new Map<Element, string>()

    screenshotOnlyFlexElements.forEach((el) => {
      const htmlEl = el as HTMLElement
      originalScreenshotOnlyDisplayValues.set(el, htmlEl.style.display)
      htmlEl.style.display = 'flex'
    })

    try {
      // Temporarily modify styles to fit content
      element.style.overflow = 'visible'
      element.style.height = 'auto'
      element.style.width = 'fit-content'
      element.style.position = 'relative'
      element.style.padding = padding

      const canvas = await html2canvas(element, {
        backgroundColor,
        scale: window.devicePixelRatio || 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
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

      // Restore screenshot-only elements
      screenshotOnlyFlexElements.forEach((el) => {
        const htmlEl = el as HTMLElement
        htmlEl.style.display = originalScreenshotOnlyDisplayValues.get(el) || ''
      })

      // Always restore styles
      element.style.overflow = originalOverflow
      element.style.height = originalHeight
      element.style.width = originalWidth
      element.style.padding = originalPadding
      element.style.position = ''
    }
  }

  async exportAllScreenshots(): Promise<void> {
    const registrations = Array.from(this.registrations.values())
    const screenshotRegistrations = registrations.filter((reg) => reg.screenshot.enabled)
    if (screenshotRegistrations.length === 0) {
      console.warn('No screenshots registered')
      return
    }

    loadingService.show('Exporting project as screenshots...')
    console.log(`Exporting ${screenshotRegistrations.length} screenshots...`)

    const zip = new JSZip()
    const timestamp = new Date().toISOString().slice(0, 10)
    let index = 1

    for (const { targetRef, screenshot } of screenshotRegistrations) {
      if (!targetRef?.value) {
        console.warn(`Skipping ${screenshot.filename}: element not found`)
        continue
      }

      try {
        const blob = await this.captureScreenshot(targetRef.value)
        if (blob) {
          zip.file(`${screenshot.filename}-${timestamp}-${index}.png`, blob)
          index++
        }
        // Small delay between screenshots to avoid overwhelming the browser
        await new Promise((resolve) => setTimeout(resolve, 100))
      } catch (error) {
        console.error(`Failed to capture ${screenshot.filename}:`, error)
        Toast.warning(`Failed to capture ${screenshot.filename}`)
      }
    }

    // Generate and download the zip file
    const zipBlob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(zipBlob)
    const link = document.createElement('a')
    const projectName = projectManager.currentProjectInfo?.name
    if (!projectName) {
      console.log('Failed to get project name')
      Toast.error('Failed to export screenshots')
      loadingService.hide()
      return
    }

    link.href = url
    link.download = `${projectName}-screenshots-${timestamp}.zip`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    console.log('All screenshots exported to zip')
    loadingService.hide()
  }

  async exportAllLatex(): Promise<void> {
    const registrations = Array.from(this.registrations.values())
    const latexEntries = registrations.flatMap((reg) =>
      reg.latexFiles.map((file) => ({
        registrationId: reg.id,
        file,
      })),
    )
    if (latexEntries.length === 0) {
      Toast.warning('No LaTeX content available to export')
      return
    }

    loadingService.show('Exporting LaTeX document...')
    console.log(`Exporting ${latexEntries.length} LaTeX sections...`)

    await new Promise((resolve) => setTimeout(resolve, 500))
    const projectName = projectManager.currentProjectInfo?.name || 'project'
    const timestamp = new Date().toISOString().slice(0, 10)

    // Build LaTeX document
    let latexDocument = `\\documentclass{article}
\\usepackage{amsmath}
\\usepackage{amssymb}
\\usepackage{geometry}
\\geometry{margin=1in}

\\title{${projectName.replace(/_/g, '\\_')}}
\\date{Exported: ${timestamp}}

\\begin{document}
\\maketitle

`
    let hasContent = false

    for (const { file } of latexEntries) {
      try {
        const resolved = await file.resolve()
        if (!resolved) {
          continue
        }

        const sectionName = file.filename
          .split('-')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ')
          .replace(/_/g, '\\_')

        latexDocument += `\\section{${sectionName}}

${resolved}
\\\\
\\\\
\\\\

`
        hasContent = true
      } catch (error) {
        console.error('Failed to resolve LaTeX content:', error)
        Toast.warning(`Failed to export ${file.filename} LaTeX section`)
      }
    }

    if (!hasContent) {
      loadingService.hide()
      Toast.warning('No LaTeX content available to export')
      return
    }

    latexDocument += `\\end{document}
`

    try {
      const blob = new Blob([latexDocument], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${projectName}-${timestamp}.tex`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      console.log('LaTeX document exported')
    } catch (error) {
      console.error('LaTeX export failed:', error)
      Toast.error('Failed to export LaTeX document')
    } finally {
      loadingService.hide()
    }
  }

  getRegistrationCount(): number {
    return this.registrations.size
  }

  clear(): void {
    this.registrations.clear()
  }
}

// Export singleton instance
export const downloadRegistry = new DownloadRegistry()
