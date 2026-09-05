<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { logIn } from '../lib/pb';

  const dispatch = createEventDispatcher<{ success: void }>();
  let identity = '';
  let password = '';
  let busy = false;
  let error = '';
  let identityInput: HTMLInputElement;

  onMount(() => identityInput.focus());

  async function submit() {
    if (!identity || !password || busy) return;
    busy = true;
    error = '';
    try {
      await logIn(identity.trim(), password);
      dispatch('success');
    } catch {
      error = 'E-Mail-Adresse oder Passwort stimmt nicht.';
    } finally {
      busy = false;
    }
  }
</script>

<main class="login-shell">
  <form class="login-card" on:submit|preventDefault={submit}>
    <div class="login-mark" aria-hidden="true">D</div>
    <h1>Dran</h1>
    <p>Das gemeinsame Brett für alles, was ansteht.</p>

    <label>
      <span>E-Mail-Adresse</span>
      <input bind:this={identityInput} bind:value={identity} type="email" autocomplete="username" required />
    </label>
    <label>
      <span>Passwort</span>
      <input bind:value={password} type="password" autocomplete="current-password" required />
    </label>
    {#if error}<p class="form-error" role="alert">{error}</p>{/if}
    <button class="primary" type="submit" disabled={busy}>{busy ? 'Einen Moment …' : 'Anmelden'}</button>
  </form>
</main>
