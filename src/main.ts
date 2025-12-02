import 'dockview-vue/dist/styles/dockview.css';
import { createApp, defineComponent, type Component } from 'vue';
import { DockviewVue } from 'dockview-vue';
import router from './router';
import { VueLatex } from 'vatex';
import { dockComponents } from './components/dockRegistry';

const App = defineComponent({
  name: 'App',
  template: `<router-view />`,
});

const app = createApp(App);
app.config.errorHandler = (err) => {
  console.log(err);
};

app.component('dockview-vue', DockviewVue);

// Register dock components from the central registry
Object.entries(dockComponents).forEach(([id, comp]) => {
  app.component(id, comp as Component);
});

app.use(router);
app.component('vue-latex', VueLatex);
app.mount(document.getElementById('app')!);
