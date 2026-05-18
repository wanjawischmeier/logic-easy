<script lang="ts">
import { defineComponent, h, computed, type PropType, getCurrentInstance } from 'vue'
import type { MenuEntry } from '@/router/dockRegistry'

export default defineComponent({
  name: 'MenuList',
  props: {
    items: { type: Array as PropType<MenuEntry[]>, required: true },
    level: { type: Number, default: 0 },
    showSubmenu: {
      type: Function as PropType<(level: number, idx: number) => void>,
      required: true,
    },
    hideSubmenu: { type: Function as PropType<(level: number) => void>, required: true },
    isOpen: { type: Function as PropType<(level: number, idx: number) => boolean>, required: true },
    runAction: { type: Function as PropType<(entry: MenuEntry) => void>, required: true },
  },
  setup(props) {
    const level = computed(() => props.level ?? 0)
    const instance = getCurrentInstance()
    const MenuListComponent = instance?.type!

    return () =>
      h(
        'ul',
        { class: 'pr-1' },
        props.items.map((entry, idx) => {
          const submenuOpen = props.isOpen(level.value, idx)
          return h('li', { class: 'relative', key: idx }, [
            h(
              'button',
              {
                class: [
                  'w-full text-left m-0.5 px-3 py-2 rounded-xs border-0! hover:bg-surface-3 disabled:bg-surface-2 disabled:text-on-surface-disabled flex justify-between text-sm',
                  { 'bg-surface-3': submenuOpen },
                ],
                disabled: (!entry.action && !entry.panelId && !entry.children) || entry.disabled,
                onClick: entry.children ? undefined : () => props.runAction(entry),
                onMouseenter:
                  entry.children && !entry.disabled
                    ? () => props.showSubmenu(level.value, idx)
                    : () => props.hideSubmenu(level.value),
                type: 'button',
              },
              [
                h('span', entry.label),
                entry.tooltip || entry.children
                  ? h('span', { class: 'flex items-center gap-2' }, [
                      entry.tooltip ? h('span', { class: 'opacity-70' }, entry.tooltip) : null,
                      entry.children ? h('span', { class: 'opacity-70' }, '›') : null,
                    ])
                  : null,
              ],
            ),
            submenuOpen && entry.children && !entry.disabled
              ? h(
                  'div',
                  {
                    class:
                      'absolute left-full top-0 -mt-0.5 ml-1 w-48 bg-surface-2 border border-surface-3 rounded z-20',
                  },
                  [
                    h(MenuListComponent, {
                      items: entry.children,
                      level: level.value + 1,
                      showSubmenu: props.showSubmenu,
                      hideSubmenu: props.hideSubmenu,
                      isOpen: props.isOpen,
                      runAction: props.runAction,
                    }),
                  ],
                )
              : null,
          ])
        }),
      )
  },
})
</script>
