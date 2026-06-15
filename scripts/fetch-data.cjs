// 构建时预取视频数据脚本
// 运行方式: node scripts/fetch-data.cjs
// 将数据保存到 public/data/ 目录，供静态网站兜底使用

const https = require('https')
const http = require('http')
const fs = require('fs')
const path = require('path')

const VIDEO_SOURCES = [
  { name: '如意资源', url: 'https://cj.rycjapi.com/api.php/provide/vod/' },
  { name: '极速资源', url: 'https://jszyapi.com/api.php/provide/vod/' },
  { name: '最大资源', url: 'https://api.zuidapi.com/api.php/provide/vod/' },
  { name: '无尽资源', url: 'https://api.wujinapi.me/api.php/provide/vod/' }
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

// 合并多个源的视频数据（去重）
function mergeVideoData (results) {
  const allVideos = []
  const seen = new Set()
  let allClass = []

  for (const result of results) {
    if (!result.success || !result.data) continue
    const data = result.data

    // 合并分类
    if (Array.isArray(data.class) && data.class.length > 0) {
      const existingNames = new Set(allClass.map(c => c.type_name))
      data.class.forEach(c => {
        if (c && c.type_name && !existingNames.has(c.type_name)) {
          allClass.push(c)
          existingNames.add(c.type_name)
        }
      })
    }

    // 合并视频列表
    const list = Array.isArray(data.list) ? data.list : []
    for (const item of list) {
      if (!item || !item.vod_id) continue
      const key = `${item.vod_name || ''}_${item.vod_year || ''}_${item.vod_id}`
      if (!seen.has(key)) {
        seen.add(key)
        allVideos.push(item)
      }
    }
  }

  // 按播放量排序
  allVideos.sort((a, b) => (parseInt(b.vod_hits) || 0) - (parseInt(a.vod_hits) || 0))

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

  // 1. 拉取各源的详情数据
  console.log('\n🔍 拉取详情数据 (ac=detail):')
  for (const source of VIDEO_SOURCES) {
    process.stdout.write(`  ↗️  ${source.name}...`)
    const result = await fetchFromSource(source, { ac: 'detail', pg: 1 })
    if (result.success) {
      const count = Array.isArray(result.data.list) ? result.data.list.length : 0
      console.log(` ✅ 获取 ${count} 条`)
    } else {
      console.log(` ❌ 失败: ${result.error}`)
    }
    results.push(result)
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
