<template>
  <canvas v-show="ui.gameMode" ref="canvas" aria-hidden="true" class="game-effects" />

  <div
    v-if="ui.gameMode"
    :aria-label="$t('game.tank')"
    class="game-tank"
    data-testid="game-tank"
    role="img"
    :style="{
      left: `${tankPosition.x}px`,
      top: `${tankPosition.y}px`,
      transform: `translate(-50%, -50%) rotate(${tankPosition.angle}deg)`,
    }"
  >
    <svg aria-hidden="true" height="56" viewBox="0 0 48 56" width="48">
      <rect
        fill="#253129"
        height="36"
        rx="4"
        stroke="#111b15"
        stroke-width="2"
        width="10"
        x="3"
        y="15"
      />

      <rect
        fill="#253129"
        height="36"
        rx="4"
        stroke="#111b15"
        stroke-width="2"
        width="10"
        x="35"
        y="15"
      />

      <path
        d="M4 22h8m-8 8h8m-8 8h8m-8 8h8M36 22h8m-8 8h8m-8 8h8m-8 8h8"
        stroke="#87937c"
        stroke-width="2"
      />

      <rect
        fill="#709648"
        height="38"
        rx="5"
        stroke="#283c24"
        stroke-width="2"
        width="24"
        x="12"
        y="13"
      />

      <path d="M15 19h18M15 46h18" stroke="#b6cb7a" stroke-width="3" />

      <rect
        fill="#abc774"
        height="27"
        rx="2"
        stroke="#283c24"
        stroke-width="2"
        width="6"
        x="21"
        y="1"
      />

      <circle cx="24" cy="32" fill="#8faf59" r="10" stroke="#283c24" stroke-width="2" />
      <circle cx="24" cy="32" fill="#d0dd9b" r="4" />
    </svg>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useMapEffects } from '@/composables/useMapEffects';
import { useUIStore } from '@/stores/ui';
const ui = useUIStore();
const canvas = ref<HTMLCanvasElement | null>(null);
const { tankPosition } = useMapEffects(canvas);
</script>

<style scoped>
.game-effects,
.game-tank {
  position: fixed;
  pointer-events: none;
  z-index: 800;
}
.game-tank {
  width: 48px;
  height: 56px;
  filter: drop-shadow(0 3px 3px rgb(0 0 0 / 45%));
}
</style>
