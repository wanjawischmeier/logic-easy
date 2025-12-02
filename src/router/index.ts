import { createRouter, createWebHistory } from 'vue-router'
import HomeScreen from '../views/HomeScreen.vue'
import DockView from '../views/DockView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/logic-easy/home',
      name: 'home',
      component: HomeScreen,
    },
    {
      path: '/logic-easy/',
      name: 'dock',
      component: DockView,
    },
  ],
})

export default router
