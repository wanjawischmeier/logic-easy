import 'dockview-vue/dist/styles/dockview.css';
import { type PropType, createApp, defineComponent } from 'vue';
import {
  DockviewVue,
  type DockviewReadyEvent,
  type IDockviewPanelProps,
} from 'dockview-vue';

const Panel = defineComponent({
  inject: ['vu3ProvideInjectEvidenceTestMessage'],
  name: 'Panel',
  props: {
    params: {
      type: Object as PropType<IDockviewPanelProps>,
      required: true,
    },
  },
  data() {
    return {
      title: '',
      message: this.vu3ProvideInjectEvidenceTestMessage ?? 'not found',
    };
  },
  mounted() {
    const disposable = this.params.api.onDidTitleChange(() => {
      this.title = this.params.api.title;
    });
    this.title = this.params.api.title;

    return () => {
      disposable.dispose();
    };
  },
  template: `
    <div style="height:100%; color:red;">
      Hello World
      <div>{{title}}</div>
      <div>{{message}}</div>
    </div>`,
});

const App = defineComponent({
  name: 'App',
  components: {
    'dockview-vue': DockviewVue,
    panel: Panel,
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
