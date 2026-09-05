<script lang="ts">
  import { memberColor } from '../lib/palette';
  import type { Member } from '../lib/types';

  export let member: Member;
  export let size: 'small' | 'normal' = 'normal';
  export let title = true;
</script>

<span
  class:small={size === 'small'}
  class="avatar"
  style:background={memberColor(member.color)}
  title={title ? member.name : undefined}
  aria-hidden="true"
>{member.emoji || member.name.slice(0, 1).toUpperCase()}</span>
