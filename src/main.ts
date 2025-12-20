import 'dockview-vue/dist/styles/dockview.css';
import { createApp, defineComponent, type Component } from 'vue';
import { DockviewVue } from 'dockview-vue';
import { VueLatex } from 'vatex';
import router from '@/router';
import { dockComponents } from '@/router/dockRegistry';
import { iframeManager } from '@/utility/iframeManager';

const App = defineComponent({
  name: 'App',
  template: `<router-view />`,
});

const app = createApp(App);
app.config.errorHandler = (err) => {
  console.log(err);
};

// Register a global custom directive called `v-focus`
// Taken from https://stackoverflow.com/a/67576157
app.directive('focus', {
  // Autofocus an element
  mounted(el) {
    el.focus()
  }
})

app.component('dockview-vue', DockviewVue);

// Register dock components from the central registry
Object.entries(dockComponents).forEach(([id, comp]) => {
  app.component(id, comp as Component);
});

app.use(router);
app.component('vue-latex', VueLatex);

app.mount(document.getElementById('app')!);

// Preload all registered iframes after app has mounted
setTimeout(() => {
  iframeManager.preloadAll();
}, 0);
