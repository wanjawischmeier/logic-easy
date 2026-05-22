import { computed, watch, type Ref } from 'vue'

export function useClampedSelection(
  indexRef: Ref<number>,
  formulasRef: Ref<string[] | undefined | null>,
) {
  const clampedSavedIndex = computed(() => {
    const len = formulasRef.value?.length ?? 0
    if (len === 0) return 0
    return Math.min(Math.max(0, indexRef.value ?? 0), Math.max(0, len - 1))
  })

  // Keep the in-memory index valid if formulas shrink
  watch(
    () => formulasRef.value?.length,
    (len) => {
      const length = len ?? 0
      if (length === 0) {
        indexRef.value = 0
        return
      }
      if (indexRef.value >= length) {
        indexRef.value = Math.max(0, length - 1)
      }
    },
  )

  return { clampedSavedIndex }
}
