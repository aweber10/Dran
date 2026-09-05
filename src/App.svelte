<script lang="ts">
  import { onMount } from 'svelte';
  import Board from './components/Board.svelte';
  import Login from './components/Login.svelte';
  import { boardStore } from './lib/store';
  import { isAuthenticated, pb } from './lib/pb';

  let authenticated = isAuthenticated();

  onMount(() => {
    const unsubscribeAuth = pb.authStore.onChange(() => {
      authenticated = isAuthenticated();
    });
    void boardStore.init();
    return () => {
      unsubscribeAuth();
      boardStore.destroy();
    };
  });

  async function loggedIn() {
    authenticated = true;
    await boardStore.afterLogin();
  }
</script>

{#if authenticated || (!$boardStore.online && $boardStore.cards.length > 0)}
  <Board />
{:else}
  <Login on:success={loggedIn} />
{/if}
