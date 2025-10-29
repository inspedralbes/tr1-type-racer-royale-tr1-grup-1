import { createRouter, createWebHistory } from "vue-router";
import HomeView from "@/pages/HomeView.vue";
import LobbyView from "@/pages/LobbyView.vue";
import { useUserStore } from "@/stores/user";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "home", component: HomeView },
    {
      path: "/lobby",
      name: "lobby",
      component: LobbyView,
      meta: { requiresNick: true },
    },
    { path: "/:pathMatch(.*)*", redirect: "/" },
  ],
});

router.beforeEach((to) => {
  const user = useUserStore();
  if (to.meta.requiresNick && !user.hasNick) {
    return {
      name: "home",
      query: { needNick: "1", redirectTo: to.fullPath },
    };
  }
});

export default router;
