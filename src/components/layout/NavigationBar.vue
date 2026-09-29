<template>
  <div v-if="instructions.gameMode" class="navigation-bar" data-testid="game-controls">
    <div class="navigation-bar-content">
      <div class="navigation-instructions">
        <span class="navigation-text">{{ $t('game.controls') }}</span>
      </div>

      <button class="navigation-exit-btn" type="button" @click="uiStore.gameMode = false">
        {{ $t('game.exit') }}
      </button>
    </div>
  </div>
  <!-- Navigation Mode -->
  <div v-else-if="instructions.navigatingElement" class="navigation-bar">
    <div class="navigation-bar-content">
      <div class="navigation-instructions">
        <span class="navigation-icon">🧭</span>

        <span class="navigation-text">
          {{ $t('navigation.useArrowKeys') }} <strong>← →</strong>
          {{ $t('navigation.arrowKeysToNavigate') }} • {{ $t('navigation.pressEsc') }}
          <strong>ESC</strong> {{ $t('navigation.toExit') }}
        </span>
      </div>

      <button class="navigation-exit-btn" type="button" @click="handleExitNavigation">
        {{ $t('navigation.exitNavigation') }}
      </button>
    </div>
  </div>

  <!-- Free Hand Drawing Mode -->
  <div v-else-if="instructions.freeHandDrawing.isDrawing" class="navigation-bar">
    <div class="navigation-bar-content">
      <div class="navigation-instructions">
        <span class="navigation-icon">✏️</span>

        <span class="navigation-text">
          <template v-if="!instructions.freeHandDrawing.startCoord">
            {{ $t('freehand.clickToSetStart') }}
          </template>

          <template v-else-if="instructions.freeHandDrawing.intersectionPointName">
            {{
              $t('freehand.intersectionThrough', {
                name: instructions.freeHandDrawing.intersectionPointName,
              })
            }}
            • {{ $t('freehand.releaseAltToUnlock') }} •
            {{
              instructions.freeHandDrawing.draggingFromPoint
                ? $t('freehand.releaseToConfirm')
                : $t('freehand.clickToConfirm')
            }}
          </template>

          <template v-else-if="instructions.freeHandDrawing.snappedPointName">
            {{
              $t('freehand.snappedToPoint', { name: instructions.freeHandDrawing.snappedPointName })
            }}
            • {{ $t('freehand.holdAltForIntersection') }}
            •
            {{
              instructions.freeHandDrawing.draggingFromPoint
                ? $t('freehand.releaseToConfirm')
                : $t('freehand.clickToConfirm')
            }}
          </template>

          <template v-else-if="instructions.freeHandDrawing.draggingFromPoint">
            {{ $t('freehand.dragToPoint') }}
          </template>

          <template v-else>
            {{ $t('freehand.moveToSetEndpoint') }} • {{ $t('freehand.clickToConfirm') }}
          </template>

          <template
            v-if="
              instructions.freeHandDrawing.azimuth === undefined &&
              !instructions.freeHandDrawing.snappedPointName &&
              !instructions.freeHandDrawing.intersectionPointName
            "
          >
            • {{ $t('freehand.holdAlt') }} <strong>ALT</strong> {{ $t('freehand.toLockAzimuth') }} •
            {{ $t('freehand.holdCtrl') }} <strong>CTRL</strong> {{ $t('freehand.toLockDistance') }}
          </template>

          • {{ $t('freehand.pressEsc') }} <strong>ESC</strong> {{ $t('freehand.toCancel') }}
        </span>
      </div>

      <button class="navigation-exit-btn" type="button" @click="handleExitFreeHand">
        {{ $t('freehand.cancelDrawing') }}
      </button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { shallowRef, watch } from 'vue';
import { useUIStore } from '@/stores/ui';

const uiStore = useUIStore();
function readInstructions() {
  return {
    gameMode: uiStore.gameMode,
    navigatingElement: uiStore.navigatingElement,
    freeHandDrawing: { ...uiStore.freeHandDrawing },
  };
}
const instructions = shallowRef(readInstructions());
// Keep the outgoing content intact until its parent finishes the slide-out.
watch(readInstructions, (state) => {
  if (state.gameMode || state.navigatingElement || state.freeHandDrawing.isDrawing) {
    instructions.value = state;
  }
});
function handleExitNavigation(): void {
  uiStore.stopNavigating();
}

function handleExitFreeHand(): void {
  uiStore.stopFreeHandDrawing();
}
</script>

<style scoped>
.navigation-bar {
  background: rgb(var(--v-theme-primary));
  border-bottom: none;
  padding: 16px 24px;
  min-height: 76px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.navigation-bar-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  max-width: 1200px;
  width: 100%;
}

.navigation-instructions {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  color: rgb(var(--v-theme-on-primary));
  font-size: 14px;
  font-weight: 500;
}

.navigation-icon {
  font-size: 18px;
  display: flex;
  align-items: center;
}

.navigation-text {
  display: block;
  min-width: 0;
  line-height: 1.8;
}

.navigation-text strong {
  display: inline-block;
  white-space: nowrap;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.2);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
}

.navigation-exit-btn {
  background: rgba(255, 255, 255, 0.15);
  border: none;
  color: rgb(var(--v-theme-on-primary));
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  font-size: 13px;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.navigation-exit-btn:hover {
  background: rgba(255, 255, 255, 0.25);
}

.navigation-exit-btn:active {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(0.98);
}

@media (max-width: 768px) {
  .navigation-bar-content {
    flex-wrap: wrap;
    gap: 12px;
  }

  .navigation-instructions {
    flex: 1 1 100%;
    flex-direction: row;
    gap: 8px;
    text-align: left;
  }
  .navigation-exit-btn {
    margin-left: auto;
  }
}
</style>
