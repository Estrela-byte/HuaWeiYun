<script setup>
import { computed } from 'vue'
import MoneyInput from '../ui/MoneyInput.vue'
import CategorySelect from './CategorySelect.vue'
const props = defineProps({
  modelValue: { type: Object, required: true },
  categories: { type: Array, default: () => [] },
  errors: { type: Object, default: () => ({}) },
  submitting: { type: Boolean, default: false },
  mode: { type: String, default: 'create' },
})
const emit = defineEmits(['submit', 'cancel'])
const form = props.modelValue
const kindOptions = [
  { value: 'sale', label: '销售' }, { value: 'expense', label: '经营支出' }, { value: 'refund', label: '退款' },
  { value: 'transfer', label: '转账' }, { value: 'settlement', label: '结算' }, { value: 'loan', label: '借款' },
  { value: 'owner_contribution', label: '业主投入' }, { value: 'other', label: '其他' },
]
const directionOptions = [{ value: 'inflow', label: '收入' }, { value: 'outflow', label: '支出' }]
const categoryDirection = computed(() => form.kind === 'refund' ? '' : form.direction)
const fieldErrorList = computed(() => Object.values(props.errors || {}).flat().filter(Boolean))
</script>

<template>
  <form @submit.prevent="$emit('submit')">
    <div class="field-row">
      <label class="field">业务日期<input v-model="form.businessDate" type="date" class="field-control" required></label>
      <label class="field">金额（元）<MoneyInput v-model="form.amountMinor" :error="errors.amountMinor?.[0]" required /></label>
      <label class="field">方向<select v-model="form.direction" class="field-control"><option v-for="opt in directionOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option></select></label>
      <label class="field">业务类型<select v-model="form.kind" class="field-control"><option v-for="opt in kindOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option></select></label>
      <label class="field">分类<CategorySelect v-model="form.categoryId" :categories="categories" :direction="categoryDirection" /></label>
      <label class="field">摘要<input v-model.trim="form.summary" class="field-control" required></label>
      <label v-if="form.kind === 'refund'" class="field">原流水 ID<input v-model.trim="form.originalTransactionId" class="field-control" placeholder="对应已入账销售或支出流水" required></label>
    </div>
    <label class="field" style="margin-top: 12px">备注<textarea v-model="form.note" class="field-control" rows="2"></textarea></label>
    <p v-if="form.kind === 'refund'" class="subtle">退款按原流水冲减经营指标，分类需沿用原流水。</p>
    <div v-if="fieldErrorList.length" class="inline-message inline-message--error" role="alert">
      <span v-for="msg in fieldErrorList" :key="msg">{{ msg }}</span>
    </div>
    <div class="form-actions">
      <button class="button" type="button" @click="$emit('cancel')">取消</button>
      <button class="button button--primary" type="submit" :disabled="submitting">{{ submitting ? '保存中…' : '保存流水' }}</button>
    </div>
  </form>
</template>