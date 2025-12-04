<template>
  <div class="fsm-page">
    <div class="page-header">
      <h2> FSM Graph Editor</h2>
      <div class="header-buttons">
        <button 
          class="btn btn-success btn-sm" 
          @click="exportFsm" 
          :disabled="!hasData"
        >
           Export JSON
        </button>
        <button class="btn btn-info btn-sm" @click="importFsm">
           Import JSON
        </button>
        <button class="btn btn-warning btn-sm" @click="clearFsm">
           Clear All
        </button>
      </div>
    </div>

    <div class="fsm-editor-container">
      <iframe 
        ref="fsmIframe"
        src="https://aylinjosephine.github.io/fsm-engine/"
        width="100%" 
        height="700px"
        frameborder="0"
        class="fsm-iframe"
        @load="onIframeLoad"
      />
    </div>

    <!-- Status -->
    <div class="status-bar">
      Status: {{ status }} | 
      Letzter Export: {{ lastExport || 'Noch keiner' }} | 
      <button class="btn-link" @click="downloadFsm">📥 Download FSM</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

interface FsmNode { id: string; x: number; y: number; label: string }
interface FsmEdge { from: string; to: string; label: string }
interface FsmData { nodes: FsmNode[]; edges: FsmEdge[] }

const fsmIframe = ref<HTMLIFrameElement>()
const fsmData = ref<FsmData | null>(null)
const status = ref<string>('Bereit')
const lastExport = ref<string | null>(null)
const hasData = ref<boolean>(false)

onMounted(() => {
  // localStorage laden
  const saved = localStorage.getItem('fsm-data')
  if (saved) {
    try {
      fsmData.value = JSON.parse(saved) as FsmData
      hasData.value = true
      lastExport.value = new Date().toLocaleString()
    } catch (e) {
      console.error('FSM Daten korrupt:', e)
    }
  }
  
  window.addEventListener('message', handleMessage as EventListener)
})

const onIframeLoad = () => {
  status.value = 'FSM Editor geladen'
  if (fsmData.value) {
    fsmIframe.value?.contentWindow?.postMessage({
      action: 'import',
      data: fsmData.value
    }, '*')
  }
}

const handleMessage = (event: MessageEvent<{ action: string; fsm?: FsmData }>) => {
  if (event.data.action === 'export' && event.data.fsm) {
    fsmData.value = event.data.fsm
    localStorage.setItem('fsm-data', JSON.stringify(event.data.fsm))
    hasData.value = true
    lastExport.value = new Date().toLocaleString()
    status.value = 'FSM exportiert & gespeichert'
  }
}

const exportFsm = (): void => {
  fsmIframe.value?.contentWindow?.postMessage({ action: 'export' }, '*')
  status.value = 'Export wird geladen...'
}

const importFsm = (): void => {
  const input = document.createElement('input') as HTMLInputElement
  input.type = 'file'
  input.accept = '.json'
  input.onchange = (e: Event): void => {
    const target = e.target as HTMLInputElement
    const file = target.files?.[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = (ev: ProgressEvent<FileReader>): void => {
      const result = ev.target?.result
      if (typeof result === 'string') {
        try {
          const data = JSON.parse(result) as FsmData
          fsmData.value = data
          localStorage.setItem('fsm-data', result)
          fsmIframe.value?.contentWindow?.postMessage({
            action: 'import',
            data
          }, '*')
          status.value = 'FSM importiert'
        } catch { // ggf Error definieren
          status.value = 'Import Fehler: Ungültiges JSON'
        }
      }
    }
    reader.readAsText(file)
  }
  input.click()
}

const clearFsm = (): void => {
  fsmData.value = null
  localStorage.removeItem('fsm-data')
  hasData.value = false
  lastExport.value = null
  status.value = 'FSM geleert'
  fsmIframe.value?.contentWindow?.postMessage({ action: 'clear' }, '*')
}

const downloadFsm = (): void => {
  if (fsmData.value) {
    const blob = new Blob([JSON.stringify(fsmData.value, null, 2)], { 
      type: 'application/json' 
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `fsm-${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }
}
</script>

<style scoped>
.fsm-page {
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem 1rem;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 2rem;
}

.header-buttons {
  display: flex;
  gap: 0.5rem;
}

.fsm-editor-container {
  box-shadow: 0 0.5rem 1.5rem rgba(0,0,0,0.1);
  border-radius: 0.5rem;
  overflow: hidden;
  border: 1px solid #dee2e6;
}

.fsm-iframe {
  display: block;
  min-height: 700px;
}

.status-bar {
  margin-top: 1.5rem;
  padding: 1rem;
  background: #f8f9fa;
  border-left: 4px solid #0d6efd;
  border-radius: 0 0.375rem 0.375rem 0;
  font-size: 0.875rem;
}

.btn {
  padding: 0.375rem 0.75rem;
  border: 1px solid transparent;
  border-radius: 0.375rem;
  cursor: pointer;
  font-size: 0.875rem;
}

.btn-sm { padding: 0.25rem 0.5rem; }

.btn-success { background: #198754; color: white; }
.btn-info { background: #0dcaf0; color: #000; }
.btn-warning { background: #ffc107; color: #000; }
.btn-link { 
  background: none; 
  border: none; 
  color: #0d6efd; 
  text-decoration: underline;
  cursor: pointer;
  padding: 0;
  font-size: inherit;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
