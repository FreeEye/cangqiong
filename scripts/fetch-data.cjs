// 构建时预取视频数据脚本
// 运行方式: node scripts/fetch-data.cjs
// 将数据保存到 public/data/ 目录，供静态网站兜底使用

const https = require('https')
const http = require('http')
const fs = require('fs')
const path = require('path')

const VIDEO_SOURCES = [
  // ─── 第一梯队：稳定高优先级
  { name: '非凡资源', url: 'https://cj.ffzyapi.com/api.php/provide/vod/' },
  { name: '量子资源', url: 'https://cj.lziapi.com/api.php/provide/vod/' },
  { name: '如意资源', url: 'https://cj.rycjapi.com/api.php/provide/vod/' },
  { name: '极速资源', url: 'https://jszyapi.com/api.php/provide/vod/' },
  // ─── 第二梯队：备选资源
  { name: '光速资源', url: 'https://api.guangsuapi.com/api.php/provide/vod/' },
  { name: '最大资源', url: 'https://api.zuidapi.com/api.php/provide/vod/' },
  { name: '无尽资源', url: 'https://api.wujinapi.com/api.php/provide/vod/' },
]

// 确保输出目录存在
const DATA_DIR = path.join(__dirname, '..', 'public', 'data')
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

// 带超时的 HTTP 请求
function fetchUrl (url, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url)
    const client = parsedUrl.protocol === 'https:' ? https : http

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      },
      timeout
    }

    const req = client.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try {
          const json = JSON.parse(data)
          resolve(json)
        } catch (e) {
          reject(new Error('Invalid JSON'))
        }
      })
    })

    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('Request timeout'))
    })
    req.end()
  })
}

// 拉取单个源
async function fetchFromSource (source, params) {
  const queryString = new URLSearchParams(params).toString()
  const url = `${source.url}?${queryString}`
  try {
    const data = await fetchUrl(url)
    return { success: true, source: source.name, data }
  } catch (error) {
    return { success: false, source: source.name, error: error.message }
  }
}

// ─── 数据去重工具（与 src/utils/api.js 保持一致） ───
function normalizeText (text) {
  if (!text) return ''
  return String(text)
    .replace(/[\s\-_·•·—–(),，。.!！?？【】\[\]《》<>\"''`~@#$%^&*+=\\|\/]/g, '')
    .toLowerCase()
    .trim()
}
function getDedupKey (item) {
  if (!item) return ''
  const nameNorm = normalizeText(item.vod_name || item.name || '')
  const year = String(item.vod_year || item.year || '0').replace(/\D/g, '')
  const directorNorm = normalizeText(item.vod_director || item.director || '').slice(0, 6)
  if (nameNorm) return `n_${nameNorm}_${year}_${directorNorm}`
  const src = item._source || 's'
  return `id_${src}_${item.vod_id || item.id || Math.random()}`
}
function mergeVideoItem (existingItem, newItem) {
  const base = (parseInt(existingItem.vod_hits) || 0) >= (parseInt(newItem.vod_hits) || 0)
    ? existingItem : newItem
  const other = base === existingItem ? newItem : existingItem
  const merged = { ...base }
  const playFromBase = String(base.vod_play_from || '').split('$$$').filter(Boolean)
  const playFromOther = String(other.vod_play_from || '').split('$$$').filter(Boolean)
  const playUrlBase = String(base.vod_play_url || '').split('$$$').filter(Boolean)
  const playUrlOther = String(other.vod_play_url || '').split('$$$').filter(Boolean)
  const playMap = new Map()
  playFromBase.forEach((name, i) => { if (name && playUrlBase[i]) playMap.set(name, playUrlBase[i]) })
  playFromOther.forEach((name, i) => { if (name && playUrlOther[i] && !playMap.has(name)) playMap.set(name, playUrlOther[i]) })
  const fromArr = Array.from(playMap.keys())
  const urlArr = Array.from(playMap.values())
  if (fromArr.length > 0) {
    merged.vod_play_from = fromArr.join('$$$')
    merged.vod_play_url = urlArr.join('$$$')
  }
  return merged
}
function deduplicateList (list) {
  const map = new Map()
  for (const item of list) {
    if (!item || !item.vod_name) continue
    const key = getDedupKey(item)
    if (map.has(key)) map.set(key, mergeVideoItem(map.get(key), item))
    else map.set(key, { ...item })
  }
  return Array.from(map.values())
}

// 合并多个源的视频数据（智能去重+合并）
function mergeVideoData (results) {
  const rawList = []
  const classSet = new Map()

  for (const result of results) {
    if (!result.success || !result.data) continue
    const data = result.data
    // 合并分类（去重，以 type_id 为键）
    if (Array.isArray(data.class)) {
      data.class.forEach(c => {
        if (c && c.type_id != null && !classSet.has(String(c.type_id))) {
          classSet.set(String(c.type_id), c)
        }
      })
    }
    // 合并视频
    if (Array.isArray(data.list)) rawList.push(...data.list)
  }

  // 智能去重 + 合并播放源
  const allVideos = deduplicateList(rawList)
  // 按播放量排序
  allVideos.sort((a, b) => (parseInt(b.vod_hits) || 0) - (parseInt(a.vod_hits) || 0))

  const allClass = Array.from(classSet.values())

  return {
    code: 1,
    msg: '数据列表',
    list: allVideos,
    total: allVideos.length,
    class: allClass
  }
}

async function main () {
  console.log('🎬 开始预取视频数据...')
  console.log('📦 输出目录:', DATA_DIR)

  const results = []

  // 1. 拉取各源的详情数据（每个源拉取 5 页）
  console.log('\n🔍 拉取详情数据 (ac=detail, pg=1~5):')
  for (const source of VIDEO_SOURCES) {
    process.stdout.write(`  ↗️  ${source.name}`)
    let totalForSource = 0
    let sourceResults = []
    for (let page = 1; page <= 5; page++) {
      process.stdout.write(` pg${page}`)
      const pageResult = await fetchFromSource(source, { ac: 'detail', pg: page })
      if (pageResult.success) {
        const list = Array.isArray(pageResult.data.list) ? pageResult.data.list : []
        totalForSource += list.length
        if (list.length > 0) {
          sourceResults.push(pageResult)
        }
        if (list.length < 20) break // 没有更多数据了
      } else {
        process.stdout.write('(失败)')
        break
      }
    }
    console.log(` ✅ 共 ${totalForSource} 条`)
    results.push(...sourceResults)
  }

  // 2. 合并数据
  console.log('\n🔧 合并数据...')
  const merged = mergeVideoData(results)
  console.log(`  ✨ 共 ${merged.list.length} 条视频, ${merged.class.length} 个分类`)

  // 3. 保存详情数据
  const detailFile = path.join(DATA_DIR, 'videos-detail.json')
  fs.writeFileSync(detailFile, JSON.stringify(merged, null, 0))
  console.log(`  💾 已保存: ${path.relative(process.cwd(), detailFile)}`)

  // 4. 拉取分类数据（作为补充）
  console.log('\n🔍 拉取分类数据 (ac=list):')
  let bestClass = merged.class
  for (const source of VIDEO_SOURCES) {
    process.stdout.write(`  ↗️  ${source.name}...`)
    const result = await fetchFromSource(source, { ac: 'list' })
    if (result.success && Array.isArray(result.data.class) && result.data.class.length > 0) {
      console.log(` ✅ 获取 ${result.data.class.length} 个分类`)
      if (result.data.class.length > bestClass.length) {
        bestClass = result.data.class
      }
    } else {
      console.log(` ⚠️  未获取到分类`)
    }
  }

  // 5. 保存分类数据
  const listFile = path.join(DATA_DIR, 'videos-list.json')
  const listData = {
    code: 1,
    msg: '分类列表',
    class: bestClass,
    list: merged.list.slice(0, 50)
  }
  fs.writeFileSync(listFile, JSON.stringify(listData, null, 0))
  console.log(`  💾 已保存: ${path.relative(process.cwd(), listFile)}`)

  console.log('\n✅ 数据预取完成！共预取', merged.list.length, '条视频数据')
  return true
}

main().catch((e) => {
  console.error('\n❌ 数据预取失败:', e.message)
  // 即使失败也不中断构建，返回空数据结构
  const fallbackData = {
    code: 1,
    msg: '暂无数据',
    list: [],
    total: 0,
    class: [
      { type_id: 1, type_pid: 0, type_name: '电影' },
      { type_id: 2, type_pid: 0, type_name: '电视剧' },
      { type_id: 3, type_pid: 0, type_name: '综艺' },
      { type_id: 4, type_pid: 0, type_name: '动漫' }
    ]
  }
  try {
    fs.writeFileSync(path.join(DATA_DIR, 'videos-detail.json'), JSON.stringify(fallbackData, null, 0))
    fs.writeFileSync(path.join(DATA_DIR, 'videos-list.json'), JSON.stringify(fallbackData, null, 0))
    console.log('⚠️  已写入空数据结构，构建可以继续')
  } catch (err) {
    console.error('无法写入数据文件:', err.message)
  }
  process.exit(0)
})
