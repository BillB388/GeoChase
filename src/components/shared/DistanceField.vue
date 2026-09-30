<template>
  <v-text-field
    v-bind="$attrs"
    :hint="displayHint"
    :label="fieldLabel"
    :model-value="displayValue"
    :persistent-hint="!!cmPerKm || persistentHint"
    @update:model-value="update"
  >
    <template v-if="cmPerKm" #append-inner>
      <div :aria-label="$t('imageMap.unit')" class="distance-units" role="group">
        <button
          v-for="option in ['km', 'cm'] as const"
          :key="option"
          :aria-pressed="unit === option"
          class="distance-unit"
          type="button"
          @click.stop="selectedUnit = option"
        >
          {{ option }}
        </button>
      </div>
    </template>
  </v-text-field>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useDistanceDisplay } from '@/composables/useDistanceDisplay';

defineOptions({ inheritAttrs: false });
const props = defineProps<{
  modelValue: number | string;
  label: string;
  hint?: string;
  persistentHint?: boolean;
}>();
const emit = defineEmits<{ 'update:modelValue': [value: number | string] }>();
const { cmPerKm } = useDistanceDisplay();
const selectedUnit = ref<'km' | 'cm'>('km');
const unit = computed(() => (cmPerKm.value ? selectedUnit.value : 'km'));
const factor = computed(() => (unit.value === 'cm' ? cmPerKm.value! : 1));
const fieldLabel = computed(() =>
  /\(km\)/.test(props.label)
    ? props.label.replace('(km)', `(${unit.value})`)
    : `${props.label} (${unit.value})`
);
const displayValue = computed(() =>
  props.modelValue === '' ? '' : Number((Number(props.modelValue) * factor.value).toPrecision(12))
);
const displayHint = computed(() => {
  if (!cmPerKm.value || props.modelValue === '' || !Number.isFinite(Number(props.modelValue))) {
    return props.hint;
  }
  const otherValue = Number(props.modelValue) * (unit.value === 'km' ? cmPerKm.value : 1);
  const equivalent = `≈ ${Number(otherValue.toPrecision(6))} ${unit.value === 'km' ? 'cm' : 'km'}`;
  return props.hint ? `${equivalent} · ${props.hint}` : equivalent;
});
function update(value: string) {
  emit('update:modelValue', value === '' || value === null ? '' : Number(value) / factor.value);
}
</script>

<style scoped>
.distance-units {
  display: flex;
  align-self: center;
  gap: 2px;
  padding: 2px;
  border-radius: 6px;
  background: var(--gc-hover);
}
.distance-unit {
  appearance: none;
  border: 0;
  background: transparent;
  cursor: pointer;
  min-width: 36px;
  min-height: 30px;
  padding: 4px 6px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--gc-ink);
}
.distance-unit[aria-pressed='true'] {
  color: rgb(var(--v-theme-on-primary));
  background: rgb(var(--v-theme-primary));
}
</style>
