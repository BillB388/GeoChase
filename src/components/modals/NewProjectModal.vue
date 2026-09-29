<template>
  <FloatingDialog
    v-model="isOpen"
    :blocking="!projectsStore.activeProject"
    max-width="480px"
    :persistent="!projectsStore.activeProject"
    @keydown.esc="closeModal"
  >
    <v-card>
      <v-card-title>{{
        $t(isRegularizing ? 'workspace.regularizeProjectTitle' : 'project.newProject')
      }}</v-card-title>

      <v-card-text>
        <p class="project-intro">
          {{
            $t(
              isRegularizing
                ? 'workspace.regularizeProjectDescription'
                : 'workspace.newProjectDescription'
            )
          }}
        </p>

        <v-form @submit.prevent="submitForm">
          <v-select
            v-if="recoverySources.length > 1 && !projectsStore.activeProject"
            v-model="selectedRecovery"
            class="mb-4"
            data-testid="recovery-source-select"
            :items="
              recoverySources.map((source, index) => ({
                title: source.name || $t('workspace.recoverySource', { number: index + 1 }),
                value: source.key,
              }))
            "
            :label="$t('workspace.recoverySelection')"
            variant="outlined"
            @update:model-value="restoreSource"
          />

          <v-text-field
            v-model="projectName"
            autofocus
            class="mb-4"
            data-testid="project-name-input"
            density="compact"
            :label="$t('project.projectName')"
            :placeholder="$t('workspace.projectPlaceholder')"
            variant="outlined"
            @keydown.enter.prevent="submitForm"
          />

          <ProjectionSelect v-model="projection" />
        </v-form>
      </v-card-text>

      <v-card-actions>
        <v-spacer />

        <v-btn
          color="primary"
          data-testid="create-project-btn"
          :disabled="!projectName.trim() || needsRecoverySelection"
          @click="submitForm"
        >
          {{ $t(isRegularizing ? 'project.saveProject' : 'workspace.createProject') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </FloatingDialog>
</template>

<script lang="ts" setup>
import type { RecoverySource } from '@/services/projectRecovery';
import type { ProjectProjection } from '@/types/project';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import FloatingDialog from '@/components/shared/FloatingDialog.vue';
import ProjectionSelect from '@/components/shared/ProjectionSelect.vue';
import { useDrawingContext, useMapContext } from '@/composables/mapContext';
import { isLanguageSet } from '@/plugins/i18n';
import {
  backupRecoverySources,
  clearUnassignedWork,
  getRecoverySources,
  saveUnassignedWork,
} from '@/services/projectRecovery';
import { useLayersStore } from '@/stores/layers';
import { useProjectsStore } from '@/stores/projects';
import { useUIStore } from '@/stores/ui';

const uiStore = useUIStore();
const layersStore = useLayersStore();
const projectsStore = useProjectsStore();
const mapContainer = useMapContext();
const drawing = useDrawingContext();
const { t } = useI18n();

const projectName = ref('');
const projection = ref<ProjectProjection>('mercator');
const recoverySources = ref<RecoverySource[]>([]);
const selectedRecovery = ref<string | null>(null);
const needsRecoverySelection = computed(
  () => !projectsStore.activeProject && recoverySources.value.length > 1 && !selectedRecovery.value
);
const isRegularizing = computed(
  () => !projectsStore.activeProject && (!layersStore.isEmpty || recoverySources.value.length > 0)
);

function restoreSource(key: string) {
  const source = recoverySources.value.find((item) => item.key === key);
  if (!source) return;
  projection.value = source.projection;
  projectName.value = source.name;
  layersStore.loadLayers(source.data);
  if (mapContainer.map.value) drawing.redrawAllElements();
}

watch(
  () => projectsStore.activeProject,
  (project) => {
    if (project) return;
    // Live work takes priority over older snapshots or stored projects.
    if (!layersStore.isEmpty) return;
    recoverySources.value = getRecoverySources();
    if (recoverySources.value.length === 1) {
      selectedRecovery.value = recoverySources.value[0]!.key;
      restoreSource(selectedRecovery.value);
    }
  },
  { immediate: true }
);

watch(
  () => mapContainer.map.value,
  (map) => {
    if (map && !projectsStore.activeProject && !layersStore.isEmpty) drawing.redrawAllElements();
  }
);

watch(
  () => [projectsStore.activeProject, layersStore.exportLayers(), projection.value],
  () => {
    if (projectsStore.activeProject || layersStore.isEmpty) return;
    try {
      saveUnassignedWork(layersStore.exportLayers(), projection.value);
    } catch {
      uiStore.addToast(t('project.errors.saveFailed'), 'error');
    }
  },
  { deep: true, immediate: true, flush: 'sync' }
);

const isOpen = computed({
  get: () =>
    uiStore.isModalOpen('newProjectModal') ||
    (!projectsStore.activeProject && !uiStore.isModalOpen('languageModal') && isLanguageSet()),
  set: (value) => {
    if (!value) {
      closeModal();
    }
  },
});

watch(isOpen, (open) => {
  if (!open) {
    projectName.value = '';
    projection.value = 'mercator';
  }
});

function submitForm() {
  const name = projectName.value.trim();
  if (needsRecoverySelection.value) return;
  if (!name) {
    uiStore.addToast(t('project.errors.invalidName'), 'error');
    return;
  }

  // Capture orphaned work before changing the active project. Persist it first;
  // a storage failure must leave the drawings and the required dialog intact.
  const preserveDrawings = !projectsStore.activeProject;
  const data = layersStore.exportLayers();
  try {
    if (preserveDrawings) backupRecoverySources();
    else projectsStore.autoSaveActiveProject(data);
    projectsStore.createAndSwitchProject(
      name,
      projection.value,
      preserveDrawings ? data : undefined
    );
    if (!preserveDrawings) {
      layersStore.clearLayers();
      mapContainer.clearLayers();
    }
    // Clear the temporary copy only once the complete project is durable.
    if (preserveDrawings) clearUnassignedWork();
    recoverySources.value = [];
    selectedRecovery.value = null;
    uiStore.addToast(t('project.created'), 'success');
    closeModal();
    projectName.value = '';
  } catch {
    uiStore.addToast(t('project.errors.saveFailed'), 'error');
  }
}

function closeModal() {
  if (!projectsStore.activeProject) return;
  uiStore.closeModal('newProjectModal');
}
</script>

<style scoped>
.project-intro {
  color: var(--gc-muted);
  font-size: 14px;
  line-height: 1.65;
  margin-bottom: 24px;
}
</style>
