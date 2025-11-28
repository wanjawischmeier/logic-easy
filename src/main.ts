import { createApp } from 'vue'
import TestEins from './TestEins.vue'
import router from './router'
import type { DockviewReadyEvent } from 'dockview-vue';

const App = {
  name: 'App',
  components: {
    'component_1': TestEins,
    'tab_1': TestEins,
  },
  methods: {
    onReady(event: DockviewReadyEvent) {
      event.api.addPanel({
        id: 'panel_1',
        component: 'component_1',
        tabComponent: 'tab_1'
      });
    },
  },
  template: `
      <dockview-vue
        @ready="onReady"
      >
      </dockview-vue>`,
};

const app = createApp(App)

app.use(router)

app.mount('#app')
