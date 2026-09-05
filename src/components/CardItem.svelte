<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import MemberAvatar from './MemberAvatar.svelte';
  import { formatDue, dueIsUrgent } from '../lib/date';
  import { memberColor } from '../lib/palette';
  import { boardStore } from '../lib/store';
  import { LISTS, LIST_LABELS, type Card, type Member } from '../lib/types';

  export let card: Card;
  export let members: Member[];

  const dispatch = createEventDispatcher<{
    dragmove: { id: string; x: number; y: number };
    dragend: { id: string; x: number; y: number };
  }>();

  let element: HTMLButtonElement;
  let startX = 0;
  let startY = 0;
  let offsetX = 0;
  let tracking = false;
  let horizontal = false;
  let dragged = false;
  let pointerType = '';

  $: assigned = card.assignees.map((id) => members.find((member) => member.id === id)).filter(Boolean) as Member[];
  $: listIndex = LISTS.indexOf(card.list);
  $: forward = listIndex < LISTS.length - 1 ? LIST_LABELS[LISTS[listIndex + 1]] : '';
  $: backward = listIndex > 0 ? LIST_LABELS[LISTS[listIndex - 1]] : '';

  function pointerDown(event: PointerEvent) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    pointerType = event.pointerType;
    startX = event.clientX;
    startY = event.clientY;
    offsetX = 0;
    tracking = true;
    horizontal = false;
    dragged = false;
  }

  function pointerMove(event: PointerEvent) {
    if (!tracking) return;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    if (!horizontal && Math.abs(dx) < 8 && Math.abs(dy) < 8) return;

    if (pointerType === 'mouse' && matchMedia('(min-width: 901px)').matches) {
      dragged = true;
      element.setPointerCapture(event.pointerId);
      dispatch('dragmove', { id: card.id, x: event.clientX, y: event.clientY });
      return;
    }
    if (!horizontal) {
      if (Math.abs(dy) > Math.abs(dx)) {
        tracking = false;
        return;
      }
      horizontal = true;
      element.setPointerCapture(event.pointerId);
    }
    offsetX = dx;
    if ((offsetX > 0 && !forward) || (offsetX < 0 && !backward)) offsetX *= 0.18;
  }

  function pointerEnd(event: PointerEvent) {
    if (!tracking) return;
    tracking = false;
    if (dragged) {
      dispatch('dragend', { id: card.id, x: event.clientX, y: event.clientY });
      setTimeout(() => (dragged = false), 0);
      return;
    }
    const threshold = 72;
    if (offsetX > threshold && forward) boardStore.moveCard(card.id, LISTS[listIndex + 1]);
    if (offsetX < -threshold && backward) boardStore.moveCard(card.id, LISTS[listIndex - 1]);
    if (Math.abs(offsetX) > 8) {
      dragged = true;
      setTimeout(() => (dragged = false), 80);
    }
    offsetX = 0;
  }

  function open() {
    if (!dragged) boardStore.openCard(card.id);
  }
</script>

<div class="card-slot" data-card-id={card.id}>
  <div class="swipe-behind forward" style:opacity={offsetX > 0 ? Math.min(1, offsetX / 72) : 0}>
    {forward ? `Nach ${forward}` : ''}
  </div>
  <div class="swipe-behind backward" style:opacity={offsetX < 0 ? Math.min(1, -offsetX / 72) : 0}>
    {backward ? `Zurück nach ${backward}` : ''}
  </div>
  <button
    bind:this={element}
    class:done={card.list === 'fertig'}
    class:dragging={dragged && pointerType === 'mouse'}
    class="task-card"
    style:transform={`translateX(${offsetX}px)`}
    type="button"
    on:pointerdown={pointerDown}
    on:pointermove={pointerMove}
    on:pointerup={pointerEnd}
    on:pointercancel={pointerEnd}
    on:click={open}
  >
    <span class="member-edge" class:empty={assigned.length === 0} aria-hidden="true">
      {#each assigned as member}
        <i style:background={memberColor(member.color)}></i>
      {/each}
    </span>
    <span class="card-body">
      <span class="card-title">{card.title}</span>
      <span class="card-meta">
        {#if card.due}
          <span class:urgent={dueIsUrgent(card.due)} class="due"><i></i>{formatDue(card.due)}</span>
        {/if}
        {#if assigned.length}
          <span class="card-avatars">
            {#each assigned as member}<MemberAvatar {member} size="small" />{/each}
          </span>
        {:else if card.list !== 'fertig'}
          <span class="nobody">niemand</span>
        {/if}
      </span>
    </span>
  </button>
</div>
