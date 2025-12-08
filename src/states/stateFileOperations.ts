import { projectManager } from '../projects/projectManager'

/**
 * Handles file picker and project loading operations
 */
export class StateFileOperations {
  /**
   * Open file picker and load a project file
   */
  async openFile(): Promise<void> {
    try {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.le,.lc'
      input.multiple = false
      input.style.display = 'none'
      document.body.appendChild(input)

      const file: File | null = await new Promise((resolve) => {
        input.addEventListener('change', () => {
          resolve(input.files && input.files[0] ? input.files[0] : null)
        }, { once: true })
        input.click()
      })

      document.body.removeChild(input)

      if (!file) return

      const extension = file.name.split('.').pop()?.toLowerCase()
      if (extension === 'le') {
        await projectManager.loadProjectFromFile(file)
      } else {
        alert('Opening of LogicCircuits projects not supported yet')
      }
    } catch (error) {
      console.error(`Failed to load project from file: ${error}`)
    }
  }
}
