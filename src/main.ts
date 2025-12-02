import 'dockview-vue/dist/styles/dockview.css';
import { createApp, defineComponent } from 'vue';
import { DockviewVue } from 'dockview-vue';
import router from './router';
import BasicPanel from './panels/BasicPanel.vue';
import EspressoTestingPanel from './panels/EspressoTestingPanel.vue';
import TruthTablePanel from './panels/TruthTablePanel.vue';
import { VueLatex } from 'vatex';
import KVDiagramPanel from './panels/KVDiagramPanel.vue';

const App = defineComponent({
  name: 'App',
  template: `<router-view />`,
});

const app = createApp(App);
app.config.errorHandler = (err) => {
  console.log(err);
};

app.component('dockview-vue', DockviewVue);
app.component('test-basic', BasicPanel);
app.component('espresso-testing', EspressoTestingPanel)
app.component('truth-table', TruthTablePanel)
app.component('kv-diagram', KVDiagramPanel)

app.use(router);
app.component('vue-latex', VueLatex);
app.mount(document.getElementById('app')!);
