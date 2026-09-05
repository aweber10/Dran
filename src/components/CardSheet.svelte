<script lang="ts">
  import { onMount } from 'svelte';
  import MemberAvatar from './MemberAvatar.svelte';
  import { dateOnly } from '../lib/date';
  import { boardStore } from '../lib/store';
  import { LISTS, LIST_LABELS, type Card, type ListKey, type Member } from '../lib/types';

  export let card: Card;
  export let members: Member[];
  export let readOnly = false;

  let title = card.title;
  let notes = card.notes;
  let due = dateOnly(card.due);
  let assignees = [...card.assignees];
  let list: ListKey = card.list;
  let titleInput: HTMLInputElement;

  onMount(() => {
    titleInput.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('keydown', keydown);
    return () => document.removeEventListener('keydown', keydown);
  });

  function toggleAssignee(id: string) {
    if (readOnly) return;
    assignees = assignees.includes(id) ? assignees.filter((candidate) => candidate !== id) : [...assignees, id];
  }

  function move(next: ListKey) {
    if (readOnly || next === list) return;
    list = next;
    boardStore.moveCard(card.id, next);
  }

  function close() {
    if (!readOnly) {
      const cleanTitle = title.trim() || card.title;
      boardStore.updateCard(card.id, { title: cleanTitle, notes, due, assignees });
    }
    boardStore.closeCard();
  }

  function remove() {
    if (!readOnly) boardStore.deleteCard(card.id);
  }
</script>

<button class="scrim" aria-label="Details schließen" on:click={close}></button>
<div class="sheet" role="dialog" aria-modal="true" aria-label="Kartendetails">
  <div class="grip"></div>
  <label class="title-field">
    <span class="sr-only">Titel</span>
    <input bind:this={titleInput} bind:value={title} maxlength="120" disabled={readOnly} />
  </label>
  <p class="where">Liegt in {LIST_LABELS[list]}</p>

  <div class="field">
    <span>Wer macht das?</span>
    <div class="picker">
      {#each members.filter((member) => member.active || assignees.includes(member.id)) as member}
        <button type="button" class="member-pick" aria-pressed={assignees.includes(member.id)} on:click={() => toggleAssignee(member.id)} disabled={readOnly}>
          <MemberAvatar {member} /> {member.name}
        </button>
      {/each}
      {#if members.length === 0}<span class="quiet-copy">Noch keine Mitglieder angelegt.</span>{/if}
    </div>
  </div>

  <div class="field">
    <span>Verschieben nach</span>
    <div class="moves">
      {#each LISTS as target}
        <button type="button" aria-current={list === target} on:click={() => move(target)} disabled={readOnly}>{LIST_LABELS[target]}</button>
      {/each}
    </div>
  </div>

  <label class="field">
    <span>Fällig am</span>
    <input class="date-input" type="date" bind:value={due} disabled={readOnly} />
  </label>

  <label class="field">
    <span>Notiz</span>
    <textarea bind:value={notes} maxlength="2000" placeholder="Nur wenn es etwas zu sagen gibt." disabled={readOnly}></textarea>
  </label>

  <footer class="sheet-foot">
    <button class="danger-link" type="button" on:click={remove} disabled={readOnly}>Karte löschen</button>
    <button class="quiet-link" type="button" on:click={close}>Fertig</button>
  </footer>
</div>
