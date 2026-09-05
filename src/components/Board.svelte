<script lang="ts">
  import CardItem from './CardItem.svelte';
  import CardSheet from './CardSheet.svelte';
  import MemberAvatar from './MemberAvatar.svelte';
  import { boardStore } from '../lib/store';
  import { isRecentDone } from '../lib/date';
  import { LISTS, LIST_LABELS, type ListKey } from '../lib/types';

  let composerOpen = false;
  let newTitle = '';
  let composerInput: HTMLInputElement;
  let draggingId: string | null = null;
  let dropList: ListKey | null = null;
  let dropTargetId: string | null = null;
  let dropAfter = false;

  $: activeMembers = $boardStore.members.filter((member) => member.active);
  $: selectedCard = $boardStore.cards.find((card) => card.id === $boardStore.selectedCardId);
  $: visibleByList = Object.fromEntries(
    LISTS.map((list) => [list, boardStore.visibleCards($boardStore, list)])
  ) as Record<ListKey, typeof $boardStore.cards>;
  $: counts = Object.fromEntries(LISTS.map((list) => [
    list,
    $boardStore.cards
      .filter((card) => card.list === list)
      .filter((card) => !$boardStore.filterMemberId || card.assignees.includes($boardStore.filterMemberId))
      .filter((card) => list !== 'fertig' || isRecentDone(card.doneAt)).length
  ])) as Record<ListKey, number>;
  $: olderDoneCount = boardStore.olderDoneCount($boardStore);

  function openComposer() {
    if ($boardStore.readOnly) return;
    composerOpen = true;
    setTimeout(() => composerInput?.focus());
  }

  function addCard() {
    if (!newTitle.trim()) {
      composerOpen = false;
      return;
    }
    boardStore.createCard(newTitle);
    newTitle = '';
    setTimeout(() => composerInput?.focus());
  }

  function composerKey(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      newTitle = '';
      composerOpen = false;
    }
  }

  function dragMove(event: CustomEvent<{ id: string; x: number; y: number }>) {
    draggingId = event.detail.id;
    const hit = document.elementFromPoint(event.detail.x, event.detail.y) as HTMLElement | null;
    const column = hit?.closest<HTMLElement>('[data-list]');
    if (!column) return;
    dropList = column.dataset.list as ListKey;
    const cardElement = hit?.closest<HTMLElement>('[data-card-id]');
    dropTargetId = cardElement?.dataset.cardId ?? null;
    if (cardElement) {
      const bounds = cardElement.getBoundingClientRect();
      dropAfter = event.detail.y > bounds.top + bounds.height / 2;
    } else {
      dropAfter = true;
    }
  }

  function dragEnd(event: CustomEvent<{ id: string }>) {
    if (dropList) boardStore.dropCard(event.detail.id, dropList, dropTargetId, dropAfter);
    draggingId = dropList = dropTargetId = null;
    dropAfter = false;
  }
</script>

<main class="app-shell">
  <header class="topbar">
    <h1>Dran</h1>
    <div class:filtering={Boolean($boardStore.filterMemberId)} class="people" aria-label="Nach Person filtern">
      {#each activeMembers as member}
        <button
          type="button"
          class:on={$boardStore.filterMemberId === member.id}
          aria-label={$boardStore.filterMemberId === member.id ? `Filter ${member.name} aufheben` : `Nur Karten von ${member.name}`}
          aria-pressed={$boardStore.filterMemberId === member.id}
          on:click={() => boardStore.toggleFilter(member.id)}
        ><MemberAvatar {member} title={false} /></button>
      {/each}
    </div>
  </header>

  {#if !$boardStore.online || $boardStore.pending || $boardStore.readOnly}
    <div class:warning={$boardStore.readOnly} class="status-line" role="status">
      {#if $boardStore.readOnly}Offline-Ansicht · zum Ändern erneut anmelden
      {:else if !$boardStore.online}Offline · {$boardStore.pending ? `${$boardStore.pending} Änderungen vorgemerkt` : 'Änderungen werden vorgemerkt'}
      {:else if $boardStore.pending}{$boardStore.pending} Änderungen werden synchronisiert …{/if}
    </div>
  {/if}

  <div class="tabs" role="tablist" aria-label="Spalten">
    {#each LISTS as list}
      <button type="button" role="tab" aria-selected={$boardStore.selectedList === list} on:click={() => boardStore.selectList(list)}>
        {LIST_LABELS[list]} <span>{counts[list] || ''}</span>
      </button>
    {/each}
  </div>

  {#if $boardStore.filterMemberId}
    <p class="filter-note">
      Nur Karten von {$boardStore.members.find((member) => member.id === $boardStore.filterMemberId)?.name}
      <button type="button" on:click={() => boardStore.clearFilter()}>Alle zeigen</button>
    </p>
  {/if}

  {#if $boardStore.loading}
    <div class="loading" aria-live="polite">Board wird geladen …</div>
  {:else}
    <section class="board-grid" aria-label="Kanban-Board">
      {#each LISTS as list}
        <section
          class:mobile-hidden={$boardStore.selectedList !== list}
          class:drop-column={draggingId && dropList === list}
          class="column"
          data-list={list}
          aria-labelledby={`column-${list}`}
        >
          <h2 id={`column-${list}`}><span>{LIST_LABELS[list]}</span><small>{counts[list]}</small></h2>
          <div class="card-list">
            {#each visibleByList[list] as card (card.id)}
              <div class:drop-before={draggingId && dropTargetId === card.id && !dropAfter} class:drop-after={draggingId && dropTargetId === card.id && dropAfter}>
                <CardItem {card} members={$boardStore.members} on:dragmove={dragMove} on:dragend={dragEnd} />
              </div>
            {:else}
              <div class="empty-state">
                {#if $boardStore.filterMemberId}<strong>Hier liegt nichts.</strong><span>Filter aufheben, um alles zu sehen.</span>
                {:else if list === 'offen'}<strong>Nichts offen.</strong><span>Angenehm.</span>
                {:else if list === 'dran'}<strong>Gerade läuft nichts.</strong><span>Wisch eine offene Karte hierher.</span>
                {:else}<strong>Noch nichts erledigt.</strong><span>Wird schon.</span>{/if}
              </div>
            {/each}
            {#if list === 'fertig' && olderDoneCount > 0}
              <button class="older" type="button" on:click={() => boardStore.toggleOlderDone()}>
                {$boardStore.showOlderDone ? 'Ältere ausblenden' : `${olderDoneCount} ältere anzeigen`}
              </button>
            {/if}
          </div>
        </section>
      {/each}
    </section>
  {/if}

  <button class="fab" type="button" aria-label="Karte hinzufügen" on:click={openComposer} disabled={$boardStore.readOnly}>+</button>

  <form class:open={composerOpen} class="composer" on:submit|preventDefault={addCard}>
    <input bind:this={composerInput} bind:value={newTitle} maxlength="120" placeholder="Was ist zu tun?" aria-label="Titel der neuen Karte" on:keydown={composerKey} />
    <button type="submit">Anlegen</button>
  </form>

  {#if $boardStore.toast}
    <div class="toast" role="status">
      <span>{$boardStore.toast.text}</span>
      {#if $boardStore.toast.undoMove}<button type="button" on:click={() => boardStore.undoMove()}>Rückgängig</button>{/if}
    </div>
  {/if}

  {#if selectedCard}
    <CardSheet card={selectedCard} members={$boardStore.members} readOnly={$boardStore.readOnly} />
  {/if}
</main>
