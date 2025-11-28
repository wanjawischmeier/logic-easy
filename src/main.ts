import 'dockview-vue/dist/styles/dockview.css';
import { createApp, defineComponent } from 'vue';
import {
  DockviewVue,
  type DockviewReadyEvent,
} from 'dockview-vue';
import BasicPanel from './components/BasicPanel.vue';



const App = defineComponent({
  name: 'App',
  components: {
    'dockview-vue': DockviewVue,
    panel: BasicPanel,
  },
  methods: {
    onReady(event: DockviewReadyEvent) {
      event.api.addPanel({
        id: 'panel_1',
        component: 'panel',
        title: 'Panel 1',
      });
      event.api.addPanel({
        id: 'panel_2',
        component: 'panel',
        title: 'Panel 2',
      });
    },
  },
  provide() {
    return {
      vu3ProvideInjectEvidenceTestMessage: 'Hello from the provider',
    };
  },
  template: `
      <dockview-vue
        style="width:100vw; height:100vh"
        class="dockview-theme-abyss"
        @ready="onReady"
      >
      </dockview-vue>`,
});

const app = createApp(App);
app.config.errorHandler = (err) => {
  console.log(err);
};
app.mount(document.getElementById('app')!);
