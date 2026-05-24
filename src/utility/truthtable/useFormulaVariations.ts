import { computed, unref, type MaybeRefOrGetter } from 'vue'
import type { FormulaVariationsMap, FunctionType } from '@/utility/types'

export function useFormulaVariations(
  formulaVariations: MaybeRefOrGetter<FormulaVariationsMap | undefined>,
  functionType?: MaybeRefOrGetter<FunctionType | undefined>,
) {
  // Helper to accept either a ref/value or a getter function
  const resolve = <T,>(v: MaybeRefOrGetter<T | undefined>): T | undefined => {
    if (typeof v === 'function') return (v as () => T | undefined)()
    return unref(v as any)
  }

  const normalForm = computed(() => resolve(formulaVariations)?.normal ?? {})

  const minimalForm = computed(() => {
    const variations = resolve(formulaVariations)
    const currentFunctionType = resolve(functionType)

    if (!variations || !currentFunctionType) return {}

    return currentFunctionType === 'Disjunctive' ? variations.disjunctive : variations.conjunctive
  })

  return {
    normalForm,
    minimalForm,
  }
}
