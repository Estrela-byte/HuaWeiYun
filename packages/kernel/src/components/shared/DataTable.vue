<script setup>
import { computed } from 'vue'
const props = defineProps({
  columns: { type: Array, default: () => [] },
  rows: { type: Array, default: () => [] },
  selectable: { type: Boolean, default: false },
  selected: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  nextCursor: { type: [String, Object], default: null },
  hasPrev: { type: Boolean, default: false },
  rowDisabled: { type: Function, default: null },
  emptyTitle: { type: String, default: '暂无数据' },
})
const emit = defineEmits(['update:selected', 'next', 'prev', 'row-open'])
const selectedSet = computed(() => new Set(props.selected))
function toggle(id) {
  const next = selectedSet.value.has(id) ? props.selected.filter(v => v !== id) : [...props.selected, id]
  emit('update:selected', next)
}
</script>

<template>
  <div>
    <div class="table-scroll">
      <table class="data-table">
        <thead>
          <tr>
            <th v-if="selectable"><span class="visually-hidden">选择</span></th>
            <th v-for="col in columns" :key="col.key" :class="col.align === 'numeric' ? 'numeric' : ''">{{ col.label }}</th>
            <th v-if="$slots.actions" class="actions">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.id">
            <td v-if="selectable"><input type="checkbox" :checked="selectedSet.has(row.id)" :value="row.id" :disabled="rowDisabled?.(row)" :aria-label="`选择 ${row.id}`" @change="toggle(row.id)"></td>
            <td v-for="col in columns" :key="col.key" :class="col.align === 'numeric' ? 'numeric' : ''">{{ col.format ? col.format(row) : row[col.key] }}</td>
            <td v-if="$slots.actions" class="actions"><slot name="actions" :row="row" /></td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-if="nextCursor || hasPrev" class="table-footer">
      <span>当前页 {{ rows.length }} 条</span>
      <div class="toolbar">
        <button type="button" class="button button--small" :disabled="!hasPrev" @click="$emit('prev')">上一页</button>
        <button type="button" class="button button--small" :disabled="!nextCursor" @click="$emit('next')">下一页</button>
      </div>
    </div>
  </div>
</template>