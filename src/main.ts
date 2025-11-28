import 'dockview-vue/dist/styles/dockview.css';
import { createApp, defineComponent } from 'vue';
import { DockviewVue } from 'dockview-vue';
import router from './router';
import BasicPanel from './panels/BasicPanel.vue';

const App = defineComponent({
  name: 'App',
  template: `<router-view />`,
});

const app = createApp(App);
app.config.errorHandler = (err) => {
  console.log(err);
};

app.component('dockview-vue', DockviewVue);
app.component('basic-panel', BasicPanel);

app.use(router);
app.mount(document.getElementById('app')!);
