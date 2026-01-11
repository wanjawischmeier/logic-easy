<template>
  <div class="inline-flex items-center gap-2 ">
    <span v-if="label" class="text-on-surface-variant select-none">{{ label }}</span>
    <div
      class="inline-flex items-center gap-0.5 rounded bg-surface-2 p-0.5 border border-surface-3 transition-colors relative"
      :class="highlightBorder ? 'hover:border-primary' : ''">
      <div class="slider absolute inset-y-0.5 rounded-xs transition-all duration-100 ease-in-out" :style="sliderStyle">
      </div>
      <button v-for="(item, idx) in values" :key="idx" :ref="el => buttonRefs[idx] = el as HTMLElement"
        @click="select(idx, item)" :aria-pressed="idx === selected"
        class="px-3 py-1.5 relative z-10 transition-colors duration-100 rounded-xs"
        :class="idx === selected ? randomSelectMode ? 'bg-linear-to-bl from-primary to-secondary bg-size-[200%_200%] bg-position-[0%_100%] animate-[gradient-flow_2s_ease_infinite]' : '' : 'hover:bg-surface-3'">
        {{ getLabel(item) }}
      </button>
    </div>
  </div>
</template>

<!-- For the random select easter egg-->
<style>
@keyframes gradient-flow {
  0% {
    background-position: 0% 50%;
  }

  50% {
    background-position: 100% 50%;
  }

  100% {
    background-position: 0% 50%;
  }
}
</style>

<script setup lang="ts">
import { stateManager } from '@/projects/stateManager';
import { computed, onMounted, ref, toRefs, watch, nextTick } from 'vue'

const props = withDefaults(defineProps<{
  values: unknown[]
  initialSelected?: number
  onSelect?: (value: unknown, index: number) => void
  labelKey?: string
  labelFn?: (v: unknown) => string
  label?: string
  highlightBorder?: boolean
}>(), {
  highlightBorder: false
})

const emit = defineEmits<{
  (e: 'update:selected', value: number | null): void
}>()

const { values, initialSelected, labelKey, labelFn, onSelect, label } = toRefs(props)

const selected = ref<number | null>(
  initialSelected?.value ?? (values.value && values.value.length ? 0 : null)
)

const buttonRefs = ref<(HTMLElement | null)[]>([])

const sliderStyle = computed(() => {
  if (selected.value === null || !buttonRefs.value.length) {
    return { width: '0px', transform: 'translateX(0px)' }
  }

  const selectedButton = buttonRefs.value[selected.value]
  if (!selectedButton) {
    return { width: '0px', transform: 'translateX(0px)' }
  }

  const width = selectedButton.offsetWidth
  const left = selectedButton.offsetLeft

  return {
    width: `${width}px`,
    transform: `translateX(${left - buttonRefs.value.length}px)`
  }
})

// Animation state tracking
let animationTimeout: number | null = null
const isAnimating = ref(false)

function equal2D<T>(a: T[][], b: T[][]): boolean {
  // outer length
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; i++) {
    const rowA = a[i];
    const rowB = b[i];
    if (!rowA || !rowB) return false

    // inner length
    if (rowA.length !== rowB.length) return false;

    for (let j = 0; j < rowA.length; j++) {
      if (rowA[j] !== rowB[j]) return false;
    }
  }

  return true
}

// For the random select easter egg
const randomSelectMode = ref(false)
function checkRandomSelectMode() {
  const truthTable = stateManager.state.truthTable
  if (!truthTable || truthTable.inputVars.length !== 4) {
    randomSelectMode.value = false
    return
  }

  randomSelectMode.value = equal2D(truthTable.values, [
    [0, 0, 0, 0],
    [1, 1, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [1, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 0, 0],
    [1, 0, 0, 0],
    [1, 0, 0, 0],
    [0, 0, 0, 0],
    [1, 1, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ])
}

onMounted(checkRandomSelectMode)
watch(stateManager.state, checkRandomSelectMode)

watch(initialSelected, (newVal, oldVal) => {
  const newIndex = newVal ?? (values.value && values.value.length ? 0 : null)
  if (newIndex !== selected.value && newIndex !== null) {
    selected.value = newIndex
    nextTick(() => {
      // Force slider style recalculation after button refs update
    })
  }
})

function getLabel(item: unknown) {
  if (labelFn?.value && typeof labelFn.value === 'function') {
    try {
      return labelFn.value(item)
    } catch {
      return String(item ?? '')
    }
  }
  if (labelKey?.value && item && typeof item === 'object') {
    const keyed = item as Record<string, unknown>
    const val = keyed[labelKey.value as string]
    return String(val ?? '')
  }
  return String(item ?? '')
}

function emitSelection(idx: number, item: unknown) {
  emit('update:selected', idx)
  if (onSelect?.value && typeof onSelect.value === 'function') {
    onSelect.value(item, idx)
  }
}

function select(idx: number, item: unknown) {
  if (randomSelectMode.value) {
    selectRandom()
    return
  }

  selected.value = idx
  nextTick(() => {
    emitSelection(idx, item)
  })
}

function selectRandom() {
  // If already animating, stop and select current
  if (isAnimating.value && animationTimeout !== null) {
    clearTimeout(animationTimeout)
    animationTimeout = null
    isAnimating.value = false

    // Emit current selection
    const targetItem = values.value[selected.value ?? 0]
    emitSelection(selected.value ?? 0, targetItem)
    return
  }

  const INITIAL_VELOCITY = 3 + Math.random() * 3 // switches per frame
  const DAMPING = 0.75 // velocity multiplier per bounce
  const MIN_VELOCITY = 0.15 // stop when velocity drops below this
  const FRAME_DELAY = 50 // milliseconds between updates

  const maxIndex = values.value.length - 1
  if (maxIndex < 0) return

  let currentPosition = selected.value ?? 0
  let velocity = INITIAL_VELOCITY
  let direction = 1
  isAnimating.value = true

  const animate = () => {
    currentPosition += velocity * direction

    // Bounce off edges
    if (currentPosition >= maxIndex) {
      currentPosition = maxIndex
      direction = -1
      velocity *= DAMPING
    } else if (currentPosition <= 0) {
      currentPosition = 0
      direction = 1
      velocity *= DAMPING
    }

    const displayIndex = Math.round(currentPosition)
    selected.value = displayIndex

    // Continue animation or finish
    if (velocity > MIN_VELOCITY) {
      animationTimeout = setTimeout(animate, FRAME_DELAY) as unknown as number
    } else {
      isAnimating.value = false
      animationTimeout = null

      // Animation complete - select target
      const targetItem = values.value[selected.value]
      emitSelection(selected.value, targetItem)
    }
  }

  animate()
}
</script>
