<template>
  <PopupBase :visible="true" title="About" :actions="actions" @close="onClose">
    <div class="flex flex-col gap-5 text-on-surface">
      <div class="flex items-start justify-between gap-6">
        <div class="space-y-3">
          <div>
            <h3 class="text-3xl font-semibold text-on-surface">LogicEasy</h3>
          </div>
          <p class="text-2sm italic text-primary">Disrupting Truth Tables Since 2026</p>
        </div>

        <img src="/logo/le_1024_iti.png" :width="170" class="shrink-0 rounded-sm" />
      </div>

      <div
        class="rounded border border-surface-3 bg-surface-2/40 p-4 leading-7 text-sm text-on-surface/85"
      >
        <p>
          An interactive web tool for digital logic design and analysis. It features truth tables,
          Karnaugh-Veitch, Quine-McCluskey minimization, state machine synthesis, and circuit
          visualization.
        </p>
        <div class="h-2"></div>
        <p>Full export capabilities to VHDL, LaTeX, images, and LogicCircuits files.</p>
      </div>

      <div class="grid gap-3 sm:grid-cols-2">
        <div class="rounded border border-surface-3 bg-surface-1 p-4">
          <p class="mb-2 text-[10px] uppercase tracking-[0.2em] text-secondary-variant">
            Source code
          </p>
          <a
            href="https://github.com/wanjawischmeier/logic-easy/"
            target="_blank"
            rel="noreferrer"
            class="text-sm text-primary underline underline-offset-4 hover:text-primary-variant"
          >
            github.com/wanjawischmeier/logic-easy/
          </a>
        </div>

        <div class="rounded border border-surface-3 bg-surface-1 p-4">
          <p class="mb-2 text-[10px] uppercase tracking-[0.2em] text-secondary-variant">
            Created by
          </p>
          <ul class="space-y-1 text-sm">
            <li>
              <a
                href="https://github.com/JulianGransee"
                target="_blank"
                rel="noreferrer"
                class="text-primary underline underline-offset-4 hover:text-primary-variant"
              >
                Julian Gransee
              </a>
            </li>
            <li>
              <a
                href="https://github.com/aylinjosephine"
                target="_blank"
                rel="noreferrer"
                class="text-primary underline underline-offset-4 hover:text-primary-variant"
              >
                Aylin Kutluk
              </a>
            </li>
            <li>
              <a
                href="https://github.com/wanjawischmeier"
                target="_blank"
                rel="noreferrer"
                class="text-primary underline underline-offset-4 hover:text-primary-variant"
              >
                Wanja Wischmeier
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div class="flex justify-end pt-1 text-xs text-secondary-variant">Version {{ version }}</div>
    </div>
  </PopupBase>
</template>

<script setup lang="ts">
import PopupBase, { type PopupAction } from '@/components/popups/PopupBase.vue'
import { popupService } from '@/utility/popupService'
import packageJson from '../../../package.json'

const version = packageJson.version

function onClose() {
  popupService.close()
}

const actions: PopupAction[] = []
</script>
