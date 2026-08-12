<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import draggable from 'vuedraggable'
import ColumnCard from '@/components/ColumnCard.vue'
import { getColumns, saveColumns } from '@/composables/db'
import type { Column } from '@/types'

const columns = ref<Column[]>([])
const loaded = ref(false)

onMounted(async () => {
  columns.value = await getColumns()
  loaded.value = true
})

watch(
  columns,
  (val) => {
    if (!loaded.value) return
    saveColumns(val)
  },
  { deep: true },
)

// —— Add column ——
const isAddingColumn = ref(false)
const newColumnInput = ref<HTMLInputElement>()
const newColumnTitle = ref('')

function startAddColumn() {
  isAddingColumn.value = true
  nextTick(() => newColumnInput.value?.focus())
}

function commitColumn() {
  const title = newColumnTitle.value.trim()
  if (title) {
    columns.value.push({
      id: crypto.randomUUID(),
      title,
      tasks: [],
      mode: 'horizontal',
      order: columns.value.length,
    })
  }
  isAddingColumn.value = false
  newColumnTitle.value = ''
}

// —— Remove column ——
function removeColumn(column: Column) {
  const index = columns.value.findIndex((c) => c === column)
  if (index !== -1) columns.value.splice(index, 1)
}
</script>

<template>
  <div class="flex w-fit">
    <draggable v-model="columns" item-key="id" class="flex gap-4 h-full">
      <template #item="{ element: column }">
        <ColumnCard :column="column" @remove="removeColumn" />
      </template>
    </draggable>

    <div class="ml-4 !w-280px">
      <div
        v-show="!isAddingColumn"
        class="btn flex items-center justify-center gap3 h-2rem text-xs text-#1f1f1f hover:text-#637381 hover:bg-#f4f6f8 border border-solid border-[#919eab33] rounded-md cursor-pointer"
        @click="startAddColumn"
      >
        <div i-carbon:add-large />
        Add Column
      </div>
      <input
        v-show="isAddingColumn"
        ref="newColumnInput"
        v-model="newColumnTitle"
        type="text"
        placeholder="Column name"
        class="box-border flex w-full h-2rem indent-2 outline-none rounded-md border border-solid border-[#919eab33] placeholder:text-#919eab focus-visible:ring-[#fda92d] focus-visible:ring-2"
        @blur="commitColumn"
        @keydown.enter="commitColumn"
      />
    </div>
    <div class="flex-auto"></div>
  </div>
</template>
