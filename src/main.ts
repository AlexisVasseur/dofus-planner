import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from '@/App.vue';
import { usePersistence } from '@/composables/usePersistence';
import '@/style.css';

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);

// Load persisted cards into the store BEFORE mounting — App.vue's onMounted fetches
// every equipped item id on boot, and reading build.cards before persistence loads
// would only see the default empty card (so no items get refetched after a cache bump).
usePersistence();
app.mount('#app');
