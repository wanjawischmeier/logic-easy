<template>
  <div class="relative" ref="dropdownContainer">
    <div class="group bg-surface-2 rounded border border-surface-3 hover:border-primary transition-colors p-0.5">
      <button @click="toggleDropdown" :disabled="isCapturing || !hasDownloadOptions"
        class="px-3 py-2 rounded-xs text-white group-hover:bg-primary transition-colors text-sm items-center gap-2"
        title="Download">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
      </button>
    </div>

    <div v-if="showDropdown"
      class="absolute right-0 mt-1 p-0.5 bg-surface-2 rounded shadow-lg border border-surface-3 z-50">
      <button v-for="item in dropdownItems" :key="item.key" @click="selectItem(item)"
        class="w-full p-2 text-left text-sm rounded-xs hover:bg-surface-3 flex justify-between gap-4">
        <span>{{ item.label }}</span>
        <span class="opacity-70">{{ item.extensionLabel }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped></style>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRef, watch } from 'vue'
import { downloadRegistry } from '@/utility/downloadRegistry'
import { loadingService } from '@/utility/loadingService'
import { Toast } from '@/utility/toastService'

const SCREENSHOT_COLOR_BG = 'transparent'
const SCEENSHOT_PADDING = '1rem'
const SCREENSHOT_EXTENSION = 'png'
const SCREENSHOT_LABEL = 'Screenshot'
const textDecoder = new TextDecoder()

type DownloadPrimitive = string | Blob | ArrayBuffer | Uint8Array | undefined
type DownloadSource = DownloadPrimitive | (() => DownloadPrimitive | Promise<DownloadPrimitive>)

interface DownloadFileDescriptor {
  label: string
  filename: string
  extension: string
  content: DownloadSource
  mimeType?: string
  appendDate?: boolean
  registerWith?: 'latex'
}

interface ScreenshotOptions {
  enabled?: boolean
  label?: string
  filename?: string
  appendDate?: boolean
  backgroundColor?: string
  padding?: string
}

interface Props {
  targetRef: HTMLElement | null
  filename?: string
  screenshot?: ScreenshotOptions
  files?: DownloadFileDescriptor[]
}

const props = withDefaults(defineProps<Props>(), {
  targetRef: null,
  filename: 'download',
  screenshot: () => ({
    enabled: true,
    label: SCREENSHOT_LABEL,
    appendDate: true,
    backgroundColor: SCREENSHOT_COLOR_BG,
    padding: SCEENSHOT_PADDING,
  }),
  files: () => [],
})

interface DropdownItem {
  key: string
  label: string
  extensionLabel: string
  type: 'screenshot' | 'file'
  file?: DownloadFileDescriptor
}

const showDropdown = ref(false)
const dropdownContainer = ref<HTMLElement | null>(null)
const targetElement = toRef(props, 'targetRef')
const isCapturing = ref(false)

const normalizedFiles = computed(() => props.files ?? [])
const screenshotConfig = computed(() => ({
  enabled: props.screenshot?.enabled ?? true,
  label: props.screenshot?.label ?? SCREENSHOT_LABEL,
  filename: props.screenshot?.filename ?? props.filename,
  appendDate: props.screenshot?.appendDate ?? true,
  backgroundColor: props.screenshot?.backgroundColor ?? SCREENSHOT_COLOR_BG,
  padding: props.screenshot?.padding ?? SCEENSHOT_PADDING,
}))
const latexFiles = computed(() =>
  normalizedFiles.value.filter((file) => file.registerWith === 'latex'),
)

const hasScreenshotOption = computed(() => screenshotConfig.value.enabled && !!targetElement.value)
const dropdownItems = computed<DropdownItem[]>(() => {
  const items: DropdownItem[] = []

  if (hasScreenshotOption.value) {
    items.push({
      key: 'screenshot',
      label: screenshotConfig.value.label,
      extensionLabel: `.${SCREENSHOT_EXTENSION}`,
      type: 'screenshot',
    })
  }

  normalizedFiles.value.forEach((file, index) => {
    const extension = normalizeExtension(file.extension)
    items.push({
      key: `file-${index}-${extension}`,
      label: file.label,
      extensionLabel: extension ? `.${extension}` : '',
      type: 'file',
      file,
    })
  })

  return items
})
const hasDownloadOptions = computed(() => dropdownItems.value.length > 0)

// Generate unique ID for registration
const registrationId = `download-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`

watch(
  () => ({
    target: targetElement.value,
    filename: props.filename,
    screenshot: props.screenshot,
    files: props.files,
  }),
  () => {
    const latexRegistrations = latexFiles.value.map((file) => ({
      filename: file.filename,
      resolve: () => resolveLatexContent(file),
    }))

    downloadRegistry.register(registrationId, {
      targetRef: targetElement,
      screenshot: {
        enabled: screenshotConfig.value.enabled && !!targetElement.value,
        filename: screenshotConfig.value.filename ?? props.filename,
      },
      latex: latexRegistrations,
    })
  },
  { immediate: true, deep: true },
)

const toggleDropdown = () => {
  if (!hasDownloadOptions.value || isCapturing.value) {
    return
  }
  showDropdown.value = !showDropdown.value
}

const closeDropdown = () => {
  showDropdown.value = false
}

const selectItem = async (item: DropdownItem) => {
  closeDropdown()
  if (item.type === 'screenshot') {
    await captureScreenshot()
    return
  }

  if (item.file) {
    await handleFileDownload(item.file)
  }
}

// Close dropdown when clicking outside
const handleClickOutside = (event: MouseEvent) => {
  if (dropdownContainer.value && !dropdownContainer.value.contains(event.target as Node)) {
    closeDropdown()
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  downloadRegistry.unregister(registrationId)
})

const handleFileDownload = async (file: DownloadFileDescriptor) => {
  try {
    const content = await resolveDownloadSource(file.content)
    if (content === undefined) {
      Toast.error(`No content available for ${file.label}`)
      return
    }

    const textContent = await ensureTextContent(content)
    const blob = new Blob([textContent], { type: file.mimeType ?? 'text/plain' })
    const extension = normalizeExtension(file.extension)
    const filename = buildFilename(
      file.filename || props.filename,
      extension,
      file.appendDate ?? true,
    )
    triggerBrowserDownload(blob, filename)
  } catch (error) {
    console.error('Download failed:', error)
    Toast.error(`Failed to download ${file.label}`)
  }
}

const captureScreenshot = async () => {
  loadingService.show('Taking screenshot')
  await new Promise((resolve) => setTimeout(resolve, 100)) // Wait 100ms to prevent flicker

  if (!targetElement.value || isCapturing.value) {
    console.error('Screenshot element not found')
    Toast.error('Failed to take screenshot')
    loadingService.hide()
    return
  }

  isCapturing.value = true

  try {
    const blob = await downloadRegistry.captureScreenshot(
      targetElement.value,
      screenshotConfig.value.backgroundColor,
      screenshotConfig.value.padding,
    )

    if (blob) {
      const filename = buildFilename(
        screenshotConfig.value.filename ?? props.filename,
        SCREENSHOT_EXTENSION,
        screenshotConfig.value.appendDate ?? true,
      )
      triggerBrowserDownload(blob, filename)
    } else {
      console.log('Failed to capture screenshot: empty blob')
      Toast.error('Failed to take screenshot')
    }
  } catch (error) {
    console.error('Screenshot failed:', error)
    Toast.error('Failed to take screenshot')
  } finally {
    isCapturing.value = false
    loadingService.hide()
  }
}

const resolveDownloadSource = async (
  source: DownloadSource,
): Promise<DownloadPrimitive | undefined> => {
  if (typeof source === 'function') {
    return await source()
  }
  return source
}

const ensureTextContent = async (value: DownloadPrimitive): Promise<string> => {
  if (typeof value === 'string') {
    return value
  }

  if (value instanceof Blob) {
    return await value.text()
  }

  if (value instanceof ArrayBuffer) {
    return textDecoder.decode(new Uint8Array(value))
  }

  if (value instanceof Uint8Array) {
    const buffer = value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength)
    return textDecoder.decode(new Uint8Array(buffer))
  }

  throw new Error('Unsupported content type for download')
}

const resolveLatexContent = async (file: DownloadFileDescriptor): Promise<string | undefined> => {
  try {
    const content = await resolveDownloadSource(file.content)
    if (content === undefined) {
      return undefined
    }
    return await ensureTextContent(content)
  } catch (error) {
    console.error('Failed to resolve LaTeX content:', error)
  }
  return undefined
}

const normalizeExtension = (extension: string): string => {
  if (!extension) {
    return ''
  }
  return extension.startsWith('.') ? extension.slice(1) : extension
}

const buildFilename = (
  base: string | undefined,
  extension: string,
  appendDate: boolean,
): string => {
  const safeBase = base && base.length > 0 ? base : 'download'
  const timestamp = new Date().toISOString().slice(0, 10)
  const suffix = appendDate ? `-${timestamp}` : ''
  return extension ? `${safeBase}${suffix}.${extension}` : `${safeBase}${suffix}`
}

const triggerBrowserDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
</script>
