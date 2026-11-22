// Renders ```mermaid blocks inside articles as a pannable node graph.
// Mermaid itself is served from /vendor/mermaid.min.js and only requested
// on pages that actually contain a diagram.

const MERMAID_SRC = '/vendor/mermaid.min.js'
const BLOCK_SELECTOR = 'pre[data-language="mermaid"]'
const MIN_SCALE = 0.25
const MAX_SCALE = 3

let mermaidPromise = null

function loadMermaid() {
  if (window.mermaid) return Promise.resolve(window.mermaid)
  if (mermaidPromise) return mermaidPromise

  mermaidPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = MERMAID_SRC
    script.async = true
    script.addEventListener('load', () => {
      if (window.mermaid) resolve(window.mermaid)
      else reject(new Error('mermaid did not register itself'))
    })
    script.addEventListener('error', () => reject(new Error('failed to load ' + MERMAID_SRC)))
    document.head.appendChild(script)
  })

  return mermaidPromise
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function attachPanZoom(stage, canvas, svg) {
  let scale = 1
  let offsetX = 0
  let offsetY = 0

  const apply = () => {
    canvas.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`
  }

  const fit = () => {
    const box = svg.viewBox && svg.viewBox.baseVal
    const width = (box && box.width) || svg.width.baseVal.value || 1
    const height = (box && box.height) || svg.height.baseVal.value || 1
    const padding = 28
    const rect = stage.getBoundingClientRect()

    // 文字可读优先：宽高都放得下就铺满，放不下时保留可读比例，交给拖动查看。
    const widthFit = (rect.width - padding * 2) / width
    const heightFit = (560 - padding * 2) / height
    scale = clamp(Math.min(widthFit, heightFit), 0.4, 1)
    const scaledWidth = width * scale
    const scaledHeight = height * scale

    // 画布高度贴合图形，避免大片空白。
    stage.style.height = `${Math.min(560, Math.max(200, Math.round(scaledHeight + padding * 2)))}px`
    const next = stage.getBoundingClientRect()
    offsetX = scaledWidth + padding * 2 <= next.width ? (next.width - scaledWidth) / 2 : padding
    offsetY = (next.height - scaledHeight) / 2
    apply()
  }

  const zoomBy = (factor, originX, originY) => {
    const next = clamp(scale * factor, MIN_SCALE, MAX_SCALE)
    if (next === scale) return
    offsetX = originX - (originX - offsetX) * (next / scale)
    offsetY = originY - (originY - offsetY) * (next / scale)
    scale = next
    apply()
  }

  const zoomAtCenter = factor => {
    const rect = stage.getBoundingClientRect()
    zoomBy(factor, rect.width / 2, rect.height / 2)
  }

  stage.addEventListener('wheel', event => {
    event.preventDefault()
    const rect = stage.getBoundingClientRect()
    zoomBy(Math.exp(-event.deltaY * 0.0015), event.clientX - rect.left, event.clientY - rect.top)
  }, { passive: false })

  let pointerId = null
  let startX = 0
  let startY = 0
  let originX = 0
  let originY = 0

  stage.addEventListener('pointerdown', event => {
    if (event.button !== 0) return
    pointerId = event.pointerId
    startX = event.clientX
    startY = event.clientY
    originX = offsetX
    originY = offsetY
    stage.classList.add('is-dragging')
    stage.setPointerCapture(pointerId)
  })

  stage.addEventListener('pointermove', event => {
    if (pointerId === null || event.pointerId !== pointerId) return
    offsetX = originX + event.clientX - startX
    offsetY = originY + event.clientY - startY
    apply()
  })

  const endDrag = event => {
    if (pointerId === null || (event && event.pointerId !== pointerId)) return
    stage.classList.remove('is-dragging')
    if (stage.hasPointerCapture(pointerId)) stage.releasePointerCapture(pointerId)
    pointerId = null
  }

  stage.addEventListener('pointerup', endDrag)
  stage.addEventListener('pointercancel', endDrag)

  return { fit, zoomAtCenter }
}

function buildBlock(svgMarkup) {
  const block = document.createElement('div')
  block.className = 'graph-block'

  const toolbar = document.createElement('div')
  toolbar.className = 'graph-toolbar'

  const title = document.createElement('span')
  title.className = 'graph-title'
  title.textContent = '流程图'

  const actions = document.createElement('div')
  actions.className = 'graph-actions'

  const hint = document.createElement('span')
  hint.className = 'graph-hint'
  hint.textContent = '拖动平移 · 滚轮缩放'

  const stage = document.createElement('div')
  stage.className = 'graph-stage'

  const canvas = document.createElement('div')
  canvas.className = 'graph-canvas'
  canvas.innerHTML = svgMarkup

  stage.appendChild(canvas)
  toolbar.append(title, hint, actions)
  block.append(toolbar, stage)

  return { block, actions, stage, canvas }
}

function addControls(actions, view) {
  const make = (label, handler, ariaLabel) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = label
    button.setAttribute('aria-label', ariaLabel)
    button.addEventListener('click', handler)
    actions.appendChild(button)
    return button
  }

  make('−', () => view.zoomAtCenter(1 / 1.25), '缩小')
  make('复位', () => view.fit(), '复位视图')
  make('+', () => view.zoomAtCenter(1.25), '放大')
}

function readSource(pre) {
  // Expressive Code renders each line as its own element, so textContent
  // would glue the lines together. Read them line by line instead.
  const lines = [...pre.querySelectorAll('.ec-line')]
  const text = lines.length > 0
    ? lines.map(line => line.textContent).join('\n')
    : pre.textContent || ''
  return text.trim()
}

async function renderBlock(mermaid, pre, index) {
  const source = readSource(pre)
  const host = pre.closest('.expressive-code') || pre
  if (!source) return

  const { svg } = await mermaid.render(`hakios-graph-${index}`, source)
  const { block, actions, stage, canvas } = buildBlock(svg)
  host.replaceWith(block)

  const svgElement = canvas.querySelector('svg')
  if (!svgElement) return
  svgElement.removeAttribute('height')
  svgElement.style.maxWidth = 'none'

  const view = attachPanZoom(stage, canvas, svgElement)
  addControls(actions, view)
  view.fit()
}

export async function initMermaidGraphs() {
  const blocks = [...document.querySelectorAll(BLOCK_SELECTOR)]
  if (blocks.length === 0) return

  let mermaid
  try {
    mermaid = await loadMermaid()
  } catch (error) {
    console.warn('[graph]', error)
    return
  }

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'loose',
    theme: 'base',
    fontFamily: "'Noto Sans CJK SC', 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif",
    themeVariables: {
      background: '#0f1218',
      primaryColor: '#161c26',
      primaryTextColor: '#e6ebf2',
      primaryBorderColor: '#3d4a5c',
      lineColor: '#4a5768',
      secondaryColor: '#1b2430',
      tertiaryColor: '#11161f',
      fontSize: '14px'
    },
    flowchart: {
      curve: 'basis',
      useMaxWidth: false,
      htmlLabels: true,
      nodeSpacing: 24,
      rankSpacing: 44,
      padding: 16
    }
  })

  let index = 0
  for (const pre of blocks) {
    try {
      await renderBlock(mermaid, pre, index++)
    } catch (error) {
      console.warn('[graph] render failed', error)
    }
  }
}
