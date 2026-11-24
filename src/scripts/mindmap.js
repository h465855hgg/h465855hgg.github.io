// Renders ```mindmap blocks as a branching diagram on a dark canvas.
//
//   ```mindmap
//   根节点
//     分支 A
//       叶子
//     分支 B
//   ```
//
// Two-space indentation defines the hierarchy. Wide containers use the
// horizontal layout: the root sits in the middle and the first level splits
// between both sides. Narrow containers (phones) use a vertical layout: the
// root sits on top, branches stack below it, and deeper levels extend to the
// right, which keeps the diagram readable instead of shrinking it.

const BLOCK_SELECTOR = 'pre[data-language="mindmap"]'
const MIN_SCALE = 0.3
const MAX_SCALE = 3
const COMPACT_MAX_WIDTH = 560

const NODE_HEIGHT = 32
const LEAF_HEIGHT = 27
const GAP_Y = 10
const GAP_X = 48
const PAD_X = 13
const ROOT_PAD_X = 22
const MARGIN = 24
const FONT_BRANCH = "600 14px 'Noto Sans CJK SC', 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif"
const FONT_LEAF = "12.5px 'Noto Sans CJK SC', 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif"
const FONT_ROOT = "700 16px 'Noto Sans CJK SC', 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif"
const ACCENTS = ['#7ea2ff', '#ffa8c0', '#7dd8ac', '#f2bd77', '#bb9bff']

let measureContext = null

function textWidth(text, font) {
  if (!measureContext) measureContext = document.createElement('canvas').getContext('2d')
  measureContext.font = font
  return measureContext.measureText(text).width
}

function readSource(pre) {
  const lines = [...pre.querySelectorAll('.ec-line')]
  const text = lines.length > 0
    ? lines.map(line => line.textContent).join('\n')
    : pre.textContent || ''
  return text.replace(/\u00a0/g, ' ').trim()
}

function parseTree(source) {
  const lines = source
    .split('\n')
    .map(line => line.replace(/\s+$/, ''))
    .filter(line => line.trim())
  if (lines.length === 0) return null

  const rootLabel = lines[0].trim().replace(/^root\(+/, '').replace(/\)+$/, '').trim()
  const root = { label: rootLabel, children: [] }
  const stack = [{ node: root, indent: -1 }]

  for (const line of lines.slice(1)) {
    let indent = 0
    while (line[indent] === ' ') indent += 1
    const label = line.trim().replace(/^[-*]\s+/, '')
    if (!label) continue
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) stack.pop()
    const node = { label, children: [] }
    stack[stack.length - 1].node.children.push(node)
    stack.push({ node, indent })
  }

  return root
}

function prepare(node, depth) {
  node.depth = depth
  node.font = depth === 0 ? FONT_ROOT : depth === 1 ? FONT_BRANCH : FONT_LEAF
  node.pad = depth === 0 ? ROOT_PAD_X : PAD_X
  node.nodeHeight = depth === 0 ? NODE_HEIGHT + 8 : depth === 1 ? NODE_HEIGHT : LEAF_HEIGHT
  node.width = Math.round(textWidth(node.label, node.font) + node.pad * 2)

  const children = node.children
  const heights = children.map(child => prepare(child, depth + 1))
  const stacked = heights.reduce((sum, height, index) => sum + height + (index > 0 ? GAP_Y : 0), 0)
  node.height = Math.max(node.nodeHeight, stacked)
  return node.height
}

function stackedHeight(nodes) {
  return nodes.reduce((sum, node, index) => sum + node.height + (index > 0 ? GAP_Y : 0), 0)
}

// Horizontal layout: root in the middle, first level split left and right.
function placeHorizontal(node, x, top, side, accent, out) {
  node.x = side === 'left' ? x - node.width : x
  node.y = top + node.height / 2 - node.nodeHeight / 2
  node.accent = accent
  out.nodes.push(node)

  if (node.children.length === 0) return

  const stacked = stackedHeight(node.children)
  let cursor = top + node.height / 2 - stacked / 2

  for (const child of node.children) {
    const childX = side === 'left' ? node.x - GAP_X : node.x + node.width + GAP_X
    placeHorizontal(child, childX, cursor, side, accent, out)
    out.edges.push({ from: node, to: child, vertical: false })
    cursor += child.height + GAP_Y
  }
}

function buildHorizontal(root) {
  prepare(root, 0)

  root.x = 0
  root.y = -root.nodeHeight / 2

  const out = { nodes: [root], edges: [] }
  const split = Math.ceil(root.children.length / 2)
  const sides = [
    { nodes: root.children.slice(0, split), side: 'right' },
    { nodes: root.children.slice(split), side: 'left' }
  ]

  let accentIndex = 0
  for (const { nodes: branches, side } of sides) {
    const stacked = stackedHeight(branches)
    let cursor = -stacked / 2

    for (const branch of branches) {
      const accent = ACCENTS[accentIndex++ % ACCENTS.length]
      const branchX = side === 'left' ? root.x - GAP_X : root.x + root.width + GAP_X
      placeHorizontal(branch, branchX, cursor, side, accent, out)
      out.edges.push({ from: root, to: branch, vertical: false })
      cursor += branch.height + GAP_Y
    }
  }

  return out
}

// Vertical layout for narrow screens: root on top, first level stacked below,
// deeper levels extend to the right.
function placeHorizontalChild(node, x, top, accent, out) {
  node.x = x
  node.y = top + node.height / 2 - node.nodeHeight / 2
  node.accent = accent
  out.nodes.push(node)

  if (node.children.length === 0) return

  const stacked = stackedHeight(node.children)
  let cursor = top + node.height / 2 - stacked / 2
  for (const child of node.children) {
    placeHorizontalChild(child, node.x + node.width + GAP_X, cursor, accent, out)
    out.edges.push({ from: node, to: child, vertical: false })
    cursor += child.height + GAP_Y
  }
}

function buildVertical(root) {
  prepare(root, 0)

  root.x = 0
  root.y = 0

  const out = { nodes: [root], edges: [] }
  let cursor = root.nodeHeight + GAP_Y
  let accentIndex = 0

  for (const branch of root.children) {
    const accent = ACCENTS[accentIndex++ % ACCENTS.length]
    placeHorizontalChild(branch, 0, cursor, accent, out)
    out.edges.push({ from: root, to: branch, vertical: true })
    cursor += branch.height + GAP_Y
  }

  return out
}

function svgElement(name, attributes) {
  const element = document.createElementNS('http://www.w3.org/2000/svg', name)
  for (const [key, value] of Object.entries(attributes)) {
    element.setAttribute(key, String(value))
  }
  return element
}

function renderSvg(out) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const node of out.nodes) {
    minX = Math.min(minX, node.x)
    minY = Math.min(minY, node.y)
    maxX = Math.max(maxX, node.x + node.width)
    maxY = Math.max(maxY, node.y + node.nodeHeight)
  }

  const offsetX = MARGIN - minX
  const offsetY = MARGIN - minY
  const totalWidth = Math.ceil(maxX - minX + MARGIN * 2)
  const totalHeight = Math.ceil(maxY - minY + MARGIN * 2)

  const svg = svgElement('svg', {
    xmlns: 'http://www.w3.org/2000/svg',
    viewBox: `0 0 ${totalWidth} ${totalHeight}`,
    width: totalWidth,
    height: totalHeight
  })

  const edgeLayer = svgElement('g', { class: 'mm-edges' })
  for (const edge of out.edges) {
    const from = edge.from
    const to = edge.to
    let d
    if (edge.vertical) {
      const startX = from.x + from.width / 2 + offsetX
      const startY = from.y + from.nodeHeight + offsetY
      const endX = to.x + to.width / 2 + offsetX
      const endY = to.y + offsetY
      const bend = Math.max(18, Math.abs(endY - startY) * 0.45)
      d = `M ${startX} ${startY} C ${startX} ${startY + bend}, ${endX} ${endY - bend}, ${endX} ${endY}`
    } else {
      // 左侧分支要从父节点左边缘出、子节点右边缘进；否则线会穿过节点并从画布左缘支出去
      const goingLeft = to.x + to.width <= from.x
      const startX = goingLeft ? from.x + offsetX : from.x + from.width + offsetX
      const startY = from.y + from.nodeHeight / 2 + offsetY
      const endX = goingLeft ? to.x + to.width + offsetX : to.x + offsetX
      const endY = to.y + to.nodeHeight / 2 + offsetY
      const bend = Math.max(26, Math.abs(endX - startX) * 0.45)
      const direction = goingLeft ? -1 : 1
      d = `M ${startX} ${startY} C ${startX + bend * direction} ${startY}, ${endX - bend * direction} ${endY}, ${endX} ${endY}`
    }

    const path = svgElement('path', {
      d,
      class: from.depth === 0 ? 'mm-edge mm-edge-root' : 'mm-edge',
      stroke: from.depth === 0 ? to.accent : 'rgba(255,255,255,0.14)'
    })
    edgeLayer.appendChild(path)
  }
  svg.appendChild(edgeLayer)

  const nodeLayer = svgElement('g', { class: 'mm-nodes' })
  for (const node of out.nodes) {
    const group = svgElement('g', { class: `mm-node mm-depth-${node.depth}` })
    const rect = svgElement('rect', {
      x: node.x + offsetX,
      y: node.y + offsetY,
      width: node.width,
      height: node.nodeHeight,
      rx: node.depth === 0 ? 10 : 8,
      class: 'mm-box'
    })
    if (node.depth <= 1) rect.style.stroke = node.accent
    if (node.depth === 1) rect.style.fill = `color-mix(in srgb, ${node.accent} 10%, #151c27)`
    if (node.depth === 0) rect.style.fill = `color-mix(in srgb, ${node.accent} 14%, #161d2a)`

    const text = svgElement('text', {
      x: node.x + offsetX + node.width / 2,
      y: node.y + offsetY + node.nodeHeight / 2,
      'text-anchor': 'middle',
      'dominant-baseline': 'central',
      class: 'mm-label'
    })
    text.textContent = node.label

    group.append(rect, text)
    nodeLayer.appendChild(group)
  }
  svg.appendChild(nodeLayer)

  return svg
}

function buildSvg(tree, compact) {
  return renderSvg(compact ? buildVertical(tree) : buildHorizontal(tree))
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
    const width = Number(svg.getAttribute('width')) || 1
    const height = Number(svg.getAttribute('height')) || 1
    const rect = stage.getBoundingClientRect()
    const padding = 20
    const maxHeight = Math.min(760, Math.round(window.innerHeight * 0.7))
    const widthFit = (rect.width - padding * 2) / width
    const heightFit = (maxHeight - padding * 2) / height
    scale = clamp(Math.min(widthFit, heightFit), MIN_SCALE, 1)

    stage.style.height = `${clamp(Math.round(height * scale + padding * 2), 180, maxHeight)}px`
    const next = stage.getBoundingClientRect()
    offsetX = (next.width - width * scale) / 2
    offsetY = (next.height - height * scale) / 2
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

const views = []

function buildBlock() {
  const block = document.createElement('div')
  block.className = 'graph-block'

  const toolbar = document.createElement('div')
  toolbar.className = 'graph-toolbar'

  const title = document.createElement('span')
  title.className = 'graph-title'
  title.textContent = '结构图'

  const hint = document.createElement('span')
  hint.className = 'graph-hint'
  hint.textContent = '拖动平移 · 滚轮缩放'

  const actions = document.createElement('div')
  actions.className = 'graph-actions'

  const stage = document.createElement('div')
  stage.className = 'graph-stage'

  const canvas = document.createElement('div')
  canvas.className = 'graph-canvas'

  stage.appendChild(canvas)
  toolbar.append(title, hint, actions)
  block.append(toolbar, stage)

  return { block, actions, stage, canvas }
}

function addControls(actions, view, block) {
  const make = (label, handler, ariaLabel) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = label
    button.setAttribute('aria-label', ariaLabel)
    button.addEventListener('click', handler)
    actions.appendChild(button)
  }

  make('−', () => view.zoomAtCenter(1 / 1.25), '缩小')
  make('复位', () => view.fit(), '复位视图')
  make('+', () => view.zoomAtCenter(1.25), '放大')
  make('全屏', () => {
    if (document.fullscreenElement) document.exitFullscreen()
    else if (block.requestFullscreen) block.requestFullscreen()
  }, '全屏查看')
}

function isCompact(block) {
  const width = block.getBoundingClientRect().width
  if (width > 0) return width < COMPACT_MAX_WIDTH
  return window.innerWidth < COMPACT_MAX_WIDTH
}

function mount(view) {
  const compact = isCompact(view.block)
  if (compact === view.compact && view.svg) {
    view.controller.fit()
    return
  }

  const tree = parseTree(view.source)
  if (!tree) return

  view.compact = compact
  view.svg = buildSvg(tree, compact)
  view.canvas.replaceChildren(view.svg)
  view.controller = attachPanZoom(view.stage, view.canvas, view.svg)
  view.actions.replaceChildren()
  addControls(view.actions, view.controller, view.block)
  view.controller.fit()
}

function renderBlock(pre) {
  const source = readSource(pre)
  const tree = parseTree(source)
  if (!tree) return

  const host = pre.closest('.expressive-code') || pre

  // Expressive Code 把整页代码块的样式表与运行时脚本注入到第一个代码块容器里，
  // 而结构图会替换这个容器；先把注入节点挪到容器前面，否则整页代码块都会失去样式。
  if (host !== pre) {
    const injected = [...host.children].filter(
      element => element.tagName === 'LINK' || element.tagName === 'SCRIPT'
    )
    for (const element of injected) host.parentNode.insertBefore(element, host)
  }

  const { block, actions, stage, canvas } = buildBlock()
  host.replaceWith(block)

  const view = { block, actions, stage, canvas, source, svg: null, controller: null, compact: null }
  views.push(view)
  mount(view)
}

export function initMindmaps() {
  const blocks = [...document.querySelectorAll(BLOCK_SELECTOR)]
  if (blocks.length === 0) return

  if (!document.documentElement.dataset.mindmapReady) {
    document.documentElement.dataset.mindmapReady = '1'
    document.addEventListener('fullscreenchange', () => {
      for (const view of views) view.controller.fit()
    })

    let resizeTimer = null
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        for (const view of views) {
          if (!view.block.isConnected) continue
          mount(view)
        }
      }, 150)
    })

    if ('ResizeObserver' in window) {
      const observer = new ResizeObserver(() => {
        for (const view of views) {
          if (!view.block.isConnected) continue
          const compact = isCompact(view.block)
          if (compact !== view.compact) mount(view)
        }
      })
      observer.observe(document.body)
    }
  }

  for (const pre of blocks) {
    try {
      renderBlock(pre)
    } catch (error) {
      console.warn('[mindmap]', error)
    }
  }
}
