<script setup>
defineEmits(['navigate'])
</script>

<template>
  <div class="landing">
    <header class="landing-header">
      <div class="brand"><span class="brand-mark" aria-hidden="true">S</span> SME-I</div>
      <button type="button" class="button button--primary" @click="$emit('navigate', 'overview')">进入工作台 →</button>
    </header>
    <main>
      <section class="landing-hero">
        <div>
          <span class="badge badge--mint">中小型企业经济智慧管理工具</span>
          <h1>让每个小店<br>都看得懂自己的账</h1>
          <p>导入微信、支付宝导出的账单，核对流水与分类，查看有依据的经营分析，再用一句话追问变化原因。</p>
          <div class="toolbar" style="margin: 28px 0"><button type="button" class="button button--primary" @click="$emit('navigate', 'overview')">开始使用 →</button><a class="button" href="#features">看看能做什么</a></div>
          <div class="landing-benefits"><span>✓ 账单导入与核对</span><span>✓ 经营指标与趋势</span><span>✓ 带证据的智能问答</span></div>
        </div>
        <div class="mascot-slot" role="img" aria-label="品牌角色插图预留区域">
          <slot name="mascot"><div><strong>SME-I 小助手</strong><p>品牌角色透明插画放在这里，页面布局已预留。</p></div></slot>
        </div>
      </section>
      <section id="features" class="feature-grid" style="max-width: 1240px; margin: 0 auto; padding: 0 28px 70px">
        <div class="card"><span class="feature-card__icon" aria-hidden="true">⇩</span><h2 class="card-title">采集与核对</h2><p class="muted">文件导入、行级预览、重复与异常提示，确认后才入账。</p></div>
        <div class="card"><span class="feature-card__icon" aria-hidden="true">◫</span><h2 class="card-title">经营分析</h2><p class="muted">同一查询范围下查看指标、趋势与成本构成。</p></div>
        <div class="card"><span class="feature-card__icon" aria-hidden="true">✦</span><h2 class="card-title">智能解释</h2><p class="muted">回答附指标与证据来源，方便回查原始流水。</p></div>
      </section>
    </main>
  </div>
</template>
