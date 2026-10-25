import { createPinia } from 'pinia';
import { createApp } from 'vue';
import 'vue-sonner/style.css';
import App from './App.vue';
import { cleanupStaleData } from './db';
import router from './router';
import './index.css';

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount('#app');

void cleanupStaleData();
